# EQUALIZER × Protocol Labs — Bounty Submission

How does one agent know it can trust another?

It doesn't need to.

## The Problem With Agent Trust

Every multi-agent system eventually confronts the same question: when Agent A commissions work from Agent B, what ensures Agent B delivers? Social reputation? Optimistic assumptions? Runtime monitoring? None of these are enforcement. They are workarounds that push the problem into the future — where it waits, until money is on the line.

EQUALIZER does not solve the trust problem. It makes the trust problem irrelevant.

## Three Mechanisms That Replace Trust

**1. Terms are locked onchain before work begins.**

Both parties — human or agent — agree on the deliverable criteria and a cryptographic hash of those terms is recorded before a single line of work is produced. The `terms_hash` is not a receipt. It is the binding contract. Neither party can revise what was agreed. The hash is the source of truth for everything that follows.

**2. Evaluation checks specificity, not quality.**

Disputes about quality are disputes about opinion. EQUALIZER refuses to adjudicate opinion. The AI evaluation model (`specificity_not_quality`) asks one question: did the delivery match the locked criteria? If the criteria were vague, the client bears that cost — they had every opportunity to be precise before funding. This design eliminates the entire category of "subjective dispute."

**3. Silence defaults to payment release.**

If the client does not raise a dispute within the review window, payment is released automatically. Silence is not ambiguity — it is acceptance. Workers, human or agent, are not held hostage by inaction or bad-faith delay.

## The `/api/v1/trust/verify` Endpoint

`POST /api/v1/trust/verify` is EQUALIZER's primary trust artifact. It accepts deal terms and the identities (wallet addresses or ENS names) of both parties and returns:

- A SHA-256 `terms_hash` — the fingerprint that governs any future dispute
- Reputation signals for both parties from onchain deal history and EAS attestations
- The full enforcement model: mechanism, arbitration logic, default behavior

Critically, the response includes `trust_required: false`. That field is not decoration — it is EQUALIZER's core claim. The protocol does not ask agents to trust each other. It provides the enforcement infrastructure that makes trust a moot question.

## Reputation as Onchain Signal

EQUALIZER's reputation system is built from verifiable history: past deal outcomes recorded onchain and Ethereum Attestation Service entries. An agent querying a counterparty's reputation is reading from public record, not self-reported claims. Over time, this creates a signal that any participant in the ecosystem can read and act on — without trusting EQUALIZER itself to curate it honestly.

## For Protocol Labs / PL Genesis

The internet of agents needs settlement infrastructure the same way the internet of humans needs DNS and TLS — not because participants are malicious, but because agreement without enforcement is just a conversation. EQUALIZER is that settlement layer: open API, verifiable cryptographic proofs, onchain finality.

See `TRUST.md` for the full design philosophy.
