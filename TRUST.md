# TRUST.md — How EQUALIZER Makes Trust Irrelevant

## The Question Every Escrow System Ignores

Most escrow tools ask: "How do we make parties trust each other?" EQUALIZER asks a different question: "What if they never needed to?"

Trust is a social construct that exists to fill gaps in enforcement. When enforcement is perfect, trust becomes optional. EQUALIZER is built on that premise.

## How It Works: Three Mechanisms That Replace Trust

**1. Terms are locked onchain before work begins.**
Both parties sign a cryptographic hash of the deal terms before a single deliverable is produced. There is no "he said / she said" — there is only the hash. The terms that were agreed to are the terms that get evaluated. Neither party can revise history.

**2. Evaluation checks specificity, not quality.**
Disputes in freelance work are almost always disputes about subjective quality. EQUALIZER sidesteps this entirely. Arbitration asks one question: did the delivery match the locked criteria? The model is called `specificity_not_quality`. If the criteria were vague, that is the client's problem — they had every opportunity to be precise before funding.

**3. Silence defaults to payment release.**
If the client does not raise a dispute within the review window, payment is released automatically. Silence is not ambiguity — it is acceptance. Workers are not held hostage by inaction.

## The `/v1/trust/verify` Endpoint

`POST /api/v1/trust/verify` is EQUALIZER's primary trust artifact. It accepts deal terms and the wallet addresses (or ENS names) of both parties, then returns:

- A SHA-256 hash of the deal terms — the fingerprint that will govern any future dispute
- Reputation data for both parties, built from onchain deal history and EAS attestations
- The full enforcement model: mechanism, arbitration logic, default behavior, and philosophy

The endpoint does not ask whether the parties trust each other. It returns the mechanisms that make the answer irrelevant.

## The Philosophy

EQUALIZER is designed for outcomes that are radically transparent and processes that are unmanipulable. A client cannot fabricate a standard that was not in the original terms. A worker cannot claim they delivered something they did not. The locked hash is the source of truth for everything.

The math enforces what both parties agreed to before either had reason to lie.

This is not a system that manages trust. It is a system that makes trust unnecessary.
