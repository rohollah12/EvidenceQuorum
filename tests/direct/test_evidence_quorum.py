import json


def _policy(min_sources=2, support=66, conflict=34):
    return json.dumps(
        {
            "min_independent_sources": min_sources,
            "min_support_percent": support,
            "max_conflict_percent": conflict,
        }
    )


def _mock_pages(vm):
    vm.mock_web(r".*source-a\.example.*", {"status": 200, "body": "Source A evidence"})
    vm.mock_web(r".*source-b\.example.*", {"status": 200, "body": "Source B evidence"})
    vm.mock_web(r".*source-c\.example.*", {"status": 200, "body": "Source C evidence"})


def test_create_case_stores_pending_case(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/evidence_quorum.py")
    direct_vm.sender = direct_alice

    case_id = contract.create_case(
        "Example claim with enough characters",
        json.dumps(["https://source-a.example/a", "https://source-b.example/b"]),
        _policy(),
    )

    case = contract.get_case(case_id)
    assert case["status"] == "PENDING"
    assert case["claim"] == "Example claim with enough characters"
    assert len(case["sources"]) == 2
    assert contract.get_case_count() == 1



def test_evaluate_case_persists_final_result(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/evidence_quorum.py")
    direct_vm.sender = direct_alice
    _mock_pages(direct_vm)

    direct_vm.mock_llm(
        r".*EvidenceQuorum.*",
        json.dumps(
            {
                "sources": [
                    {
                        "index": 0,
                        "stance": "SUPPORTS",
                        "relevant": True,
                        "origin_key": "source-a.example",
                        "reason": "Independent support A.",
                    },
                    {
                        "index": 1,
                        "stance": "SUPPORTS",
                        "relevant": True,
                        "origin_key": "source-b.example",
                        "reason": "Independent support B.",
                    },
                ],
                "case_summary": "Two independent origins support the claim.",
            }
        ),
    )

    case_id = contract.create_case(
        "Example claim with enough characters",
        json.dumps(["https://source-a.example/a", "https://source-b.example/b"]),
        _policy(),
    )
    raw = contract.evaluate_case(case_id)
    evaluated = contract.get_case(case_id)

    assert json.loads(raw)["status"] == "SUPPORTED"
    assert evaluated["status"] == "SUPPORTED"
    assert evaluated["result"]["metrics"]["supporting_independent_groups"] == 2


def test_republisher_dedup_still_reaches_two_origin_quorum(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy("contracts/evidence_quorum.py")
    direct_vm.sender = direct_alice
    _mock_pages(direct_vm)

    # source-a and source-b are treated as the same underlying Reuters origin;
    # source-c is an independent official origin. Three URLs -> two votes.
    direct_vm.mock_llm(
        r".*EvidenceQuorum.*",
        json.dumps(
            {
                "sources": [
                    {
                        "index": 0,
                        "stance": "SUPPORTS",
                        "relevant": True,
                        "origin_key": "reuters.com",
                        "reason": "Reports the event.",
                    },
                    {
                        "index": 1,
                        "stance": "SUPPORTS",
                        "relevant": True,
                        "origin_key": "reuters.com",
                        "reason": "Syndicates the same Reuters reporting.",
                    },
                    {
                        "index": 2,
                        "stance": "SUPPORTS",
                        "relevant": True,
                        "origin_key": "official.example",
                        "reason": "Independent first-party confirmation.",
                    },
                ],
                "case_summary": "Two independent origins support the claim.",
            }
        ),
    )

    raw = contract.analyze(
        "Example claim with enough characters",
        json.dumps(
            [
                "https://source-a.example/a",
                "https://source-b.example/b",
                "https://source-c.example/c",
            ]
        ),
        _policy(),
    )
    result = json.loads(raw)

    assert result["status"] == "SUPPORTED"
    assert result["metrics"]["submitted_sources"] == 3
    assert result["metrics"]["supporting_independent_groups"] == 2
    assert result["metrics"]["decisive_independent_groups"] == 2


def test_three_urls_same_origin_are_not_three_votes(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/evidence_quorum.py")
    direct_vm.sender = direct_alice
    _mock_pages(direct_vm)

    direct_vm.mock_llm(
        r".*EvidenceQuorum.*",
        json.dumps(
            {
                "sources": [
                    {
                        "index": 0,
                        "stance": "SUPPORTS",
                        "relevant": True,
                        "origin_key": "wire.example",
                        "reason": "Original report.",
                    },
                    {
                        "index": 1,
                        "stance": "SUPPORTS",
                        "relevant": True,
                        "origin_key": "wire.example",
                        "reason": "Republication.",
                    },
                    {
                        "index": 2,
                        "stance": "SUPPORTS",
                        "relevant": True,
                        "origin_key": "wire.example",
                        "reason": "Republication.",
                    },
                ],
                "case_summary": "All pages trace to one evidence origin.",
            }
        ),
    )

    result = json.loads(
        contract.analyze(
            "Example claim with enough characters",
            json.dumps(
                [
                    "https://source-a.example/a",
                    "https://source-b.example/b",
                    "https://source-c.example/c",
                ]
            ),
            _policy(),
        )
    )

    assert result["metrics"]["independent_groups"] == 1
    assert result["status"] == "INSUFFICIENT_EVIDENCE"


def test_balanced_independent_conflict_is_disputed(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/evidence_quorum.py")
    direct_vm.sender = direct_alice
    _mock_pages(direct_vm)

    direct_vm.mock_llm(
        r".*EvidenceQuorum.*",
        json.dumps(
            {
                "sources": [
                    {
                        "index": 0,
                        "stance": "SUPPORTS",
                        "relevant": True,
                        "origin_key": "source-a.example",
                        "reason": "Supports.",
                    },
                    {
                        "index": 1,
                        "stance": "CONTRADICTS",
                        "relevant": True,
                        "origin_key": "source-b.example",
                        "reason": "Contradicts.",
                    },
                ],
                "case_summary": "Independent evidence conflicts.",
            }
        ),
    )

    result = json.loads(
        contract.analyze(
            "Example claim with enough characters",
            json.dumps(["https://source-a.example/a", "https://source-b.example/b"]),
            _policy(),
        )
    )
    assert result["status"] == "DISPUTED"
    assert result["metrics"]["support_percent"] == 50
    assert result["metrics"]["conflict_percent"] == 50


def test_rejects_private_urls(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/evidence_quorum.py")
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Local/private source URLs are not allowed"):
        contract.analyze(
            "Example claim with enough characters",
            json.dumps(["http://127.0.0.1/a", "https://source-b.example/b"]),
            _policy(),
        )


def test_rejects_short_claim_with_sdk_user_error(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/evidence_quorum.py")
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Claim is too short"):
        contract.create_case(
            "short",
            json.dumps(["https://source-a.example/a", "https://source-b.example/b"]),
            _policy(),
        )


def test_missing_case_paths_revert_cleanly(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/evidence_quorum.py")
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Case not found"):
        contract.get_case("999")

    with direct_vm.expect_revert("Case not found"):
        contract.evaluate_case("999")
