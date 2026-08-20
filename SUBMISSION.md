# EvidenceQuorum — submission text

## Title

**EvidenceQuorum — Independent-Evidence Quorum Primitive**

## Short description

EvidenceQuorum is a GenLayer Intelligent Contract that decides whether supplied web evidence reaches an **independent corroboration quorum** for a bounded natural-language claim. Instead of counting URLs, it identifies the attributable origin behind each source, collapses republications/syndication into one evidence group, and applies a deterministic configurable quorum policy.

## Submission description

Multi-source verification often treats every URL as an independent vote. That assumption is unsafe: several news pages can all repeat the same wire report, press release, or upstream source. EvidenceQuorum makes evidence independence part of the Intelligent Contract itself.

For each case, the contract renders 2–5 source URLs inside GenLayer, uses constrained non-deterministic reasoning to classify each source as supporting, contradicting, or neutral, and identifies the attributable evidence origin (`origin_key`). Sources that trace to the same origin are collapsed into a single group. The contract then applies an explicit integer quorum policy to produce one of four states: `SUPPORTED`, `CONTRADICTED`, `DISPUTED`, or `INSUFFICIENT_EVIDENCE`.

The contract uses a custom leader/validator equivalence rule. Validators independently refetch and reanalyze the evidence rather than merely checking the leader's JSON format. Final state and policy must match exactly; source stance, relevance, evidence-origin grouping, and independent-group counts must agree within tightly bounded tolerances. Free-form explanations are not consensus-critical.

The contract also demonstrates thoughtful state design through `create_case` / `evaluate_case` / `get_case`, while a convenience `analyze` method powers the included Vercel interface through `simulateWriteContract`. The UI exists only to demonstrate the primitive; web retrieval, source-origin detection, quorum logic, and consensus all live in the Intelligent Contract.

Potential uses include prediction-market evidence, insurance/event resolution, agent disputes, DAO governance, reputation systems, and any downstream contract that needs to distinguish genuine corroboration from repeated copies of the same evidence.

## Why this is more than an AI wrapper

- The LLM does not directly choose the final state.
- Semantic reasoning is limited to source stance, relevance, and attributable origin.
- Duplicate/syndicated evidence is collapsed before voting.
- Final resolution is deterministic from a caller-defined integer policy.
- Validators independently reproduce the evidence analysis.
- The equivalence rule compares stable consensus fields, not prose.
- Cases have an explicit on-chain lifecycle and stored result.

## Reviewer demo in 30 seconds

1. Enter a claim and three URLs.
2. Use two URLs that repeat the same underlying report and one genuinely independent source.
3. Run the contract.
4. Show that the UI reports three submitted URLs but only two independent evidence origins.
5. Show the final state and the exact quorum thresholds used to derive it.

## Suggested one-line pitch

**EvidenceQuorum prevents “three links” from being mistaken for “three independent sources.”**
