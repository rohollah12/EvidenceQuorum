# EvidenceQuorum

**EvidenceQuorum is a GenLayer Intelligent Contract primitive for independent-source corroboration.**

It does not simply ask an LLM whether a claim is true. Instead, the contract reads 2–5 supplied web sources, determines how each source relates to a bounded claim, identifies the **attributable evidence origin** behind each page, collapses syndicated/repeated reporting into one independent group, and applies an explicit integer quorum policy.

This repository also contains a minimal Next.js/Vercel interface. The interface is intentionally thin: the consensus-critical web retrieval, source analysis, independence grouping, quorum calculation, and validator logic remain in `contracts/evidence_quorum.py`.

## Why this primitive exists

A naive multi-source oracle can be fooled by link count:

```text
news-a.example  ─┐
news-b.example  ─┼── all reproduce Reuters ──> one evidence origin
news-c.example  ─┘
```

Three URLs are not necessarily three independent sources.

EvidenceQuorum makes **independence** part of the contract decision. A page that republishes or materially relies on the same underlying report shares the same `origin_key`, so it contributes only one quorum vote.

## Contract outputs

The contract resolves to one of four bounded states:

- `SUPPORTED`
- `CONTRADICTED`
- `DISPUTED`
- `INSUFFICIENT_EVIDENCE`

The result also contains:

- per-source stance (`SUPPORTS`, `CONTRADICTS`, `NEUTRAL`)
- accessibility and relevance
- attributable `origin_key`
- independent origin groups
- supporting / contradicting group counts
- integer support and conflict percentages
- the exact quorum policy that was applied

## Quorum policy

The caller supplies three integer parameters:

```json
{
  "min_independent_sources": 2,
  "min_support_percent": 66,
  "max_conflict_percent": 34
}
```

The contract first collapses relevant sources by attributable origin. A group that contains both supporting and contradicting material is neutralized rather than double-counted.

Let:

```text
D = supporting independent groups + contradicting independent groups
support_percent  = floor(100 * support_groups / D)
conflict_percent = floor(100 * contradict_groups / D)
```

Resolution is deterministic after the semantic source analysis:

```text
if D < min_independent_sources:
    INSUFFICIENT_EVIDENCE
elif support_groups >= min_independent_sources
     and support_percent >= min_support_percent
     and conflict_percent <= max_conflict_percent:
    SUPPORTED
elif contradict_groups >= min_independent_sources
     and conflict_percent >= min_support_percent
     and support_percent <= max_conflict_percent:
    CONTRADICTED
else:
    DISPUTED
```

## Consensus / Equivalence Principle

The interesting part of this project is not a format validator.

The **leader**:

1. renders every submitted URL inside GenLayer with `gl.nondet.web.render`;
2. asks the model for a constrained per-source stance and evidence-origin classification;
3. normalizes those fields;
4. collapses sources into independent origin groups;
5. deterministically computes the quorum outcome.

The **validator independently repeats the same web retrieval and analysis**. It then compares only consensus-critical fields:

- final status must match exactly;
- policy and submitted-source count must match exactly;
- supporting / contradicting / decisive group counts may drift by at most one;
- per-source stance, relevance, and origin must agree for all sources when there are two URLs, or all but one when there are 3–5 URLs;
- free-form explanation text is deliberately ignored.

This makes the equivalence rule tolerant to harmless wording variation while still requiring agreement on the evidence structure and final state.

## State design

The contract supports both a reusable stateful workflow and a stateless-style demo call.

### Stateful primitive

```text
create_case(claim, urls_json, policy_json)
    -> stores PENDING case

evaluate_case(case_id)
    -> runs GenLayer consensus
    -> stores final status + structured result

get_case(case_id)
get_case_count()
```

Each stored case contains:

```text
id
creator
claim
source URLs
quorum policy
status
result JSON
```

### Demo convenience method

```text
analyze(claim, urls_json, policy_json)
```

The Vercel API route calls `analyze` through `simulateWriteContract`. This keeps the public demo usable without putting a private signing key in Vercel. **Simulation executes the contract logic for the demo but does not create a persistent on-chain case or transaction.** Use `create_case` + `evaluate_case` as real writes when you want the stateful workflow.

## Repository structure

```text
EvidenceQuorum/
├─ app/
│  ├─ page.tsx                  # working UI
│  ├─ layout.tsx
│  └─ api/analyze/route.ts      # Vercel -> genlayer-js -> contract
├─ contracts/
│  └─ evidence_quorum.py        # submission-critical Intelligent Contract
├─ tests/direct/
│  └─ test_evidence_quorum.py   # direct-mode contract tests
├─ .env.example
├─ gltest.config.yaml
├─ package.json
├─ requirements.txt
├─ SUBMISSION.md
└─ README.md
```

## Limits by design

To keep validator work bounded and agreement practical:

- claim length: max 600 characters
- evidence URLs: 2–5
- source URL length: max 700 characters
- each rendered page snapshot: max 6,000 characters
- policy uses integer percentages only
- duplicate URLs are rejected
- obvious localhost/private IPv4 targets are rejected

## 1. Deploy the contract in GenLayer Studio

The project uses a lightweight Next.js server route to interact with the deployed Intelligent Contract.

1. Open GenLayer Studio.
2. Create/open an Intelligent Contract.
3. Paste `contracts/evidence_quorum.py`.
4. Deploy it.
5. Copy the deployed contract address.

The contract uses the `py-genlayer` runner pattern supported by the GenLayer project boilerplate:

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

## 2. Run the web interface locally

Create `.env` from `.env.example`:

```bash
GENLAYER_ENDPOINT=https://studio.genlayer.com/api
GENLAYER_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_EVIDENCEQUORUM_ADDRESS
```

Then:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 3. Deploy the interface on Vercel

1. Create a new GitHub repository for EvidenceQuorum and upload this repository's contents.
2. In Vercel choose **Add New Project** and import that GitHub repository.
3. Keep the framework preset as **Next.js**.
4. Add these environment variables:

```text
GENLAYER_ENDPOINT=https://studio.genlayer.com/api
GENLAYER_CONTRACT_ADDRESS=<your deployed contract address>
```

5. Deploy.

No `GITHUB_TOKEN` is needed. No browser wallet or private key is needed for the public demo because `/app/api/analyze/route.ts` uses `simulateWriteContract`.

## 4. Tests

The included direct tests cover:

- stateful case creation and evaluation persistence
- successful quorum with two independent origins
- three different URLs that collapse to one origin
- disputed independent evidence
- rejection of private/local URLs
- SDK-aligned `gl.vm.UserError` validation reverts
- missing-case reverts for both `get_case` and `evaluate_case`

With the GenLayer development dependencies installed:

```bash
pip install -r requirements.txt
pytest tests/direct/ -v
```

The repository also runs the same direct suite automatically in GitHub Actions via
`.github/workflows/direct-tests.yml`. This provides a reproducible public test result for
reviewers.

You can also lint the contract with the current GenVM linter:

```bash
genvm-lint check contracts/evidence_quorum.py
```

## Suggested demo

1. Enter one precise factual claim.
2. Add 3 sources.
3. Use the default policy `2 / 66 / 34`.
4. Click **Analyze with EvidenceQuorum**.
5. Show reviewers:
   - the final state;
   - the independent-origin count;
   - each source's `origin_key`;
   - how multiple pages can collapse to one origin;
   - the deterministic quorum thresholds.

A particularly good demo is to deliberately provide two republications of the same wire report plus one genuinely independent source. The UI makes it visible that three URLs do not automatically become three votes.

## What EvidenceQuorum is not

EvidenceQuorum is **not** a universal truth oracle and does not claim that an LLM can establish objective truth. Its narrower invariant is:

> Given a bounded claim, supplied web evidence, and an explicit quorum policy, determine whether sufficiently independent evidence origins corroborate or contradict that claim.

Source-origin attribution is semantic and therefore can be imperfect. The custom validator is designed to require agreement on the consensus-critical structure and final outcome while tolerating minor semantic drift.

## Relationship to existing GenLayer examples

GenLayer already has examples/projects for single-source fact checking, citation verification, and multi-source oracle resolution. EvidenceQuorum focuses on a different reusable primitive: **preventing evidence-count inflation by identifying common evidence origins before quorum calculation**.

That source-independence layer is the reason to use this contract rather than a simple `claim + URLs -> AI verdict` wrapper.

## License

MIT
