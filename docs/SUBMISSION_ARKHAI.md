# EQUALIZER × Arkhai — Bounty Submission

EQUALIZER is an escrow protocol with trust primitives built on AI obligation enforcement.

## The Escrow Primitive

Funds are held in `Escrow.sol`, deployed on Base Sepolia at `0x7a5c38be124c78da88D4C9F5ebEf72dC41869010`. The contract does not release funds on request. It releases funds on verified delivery — or on the binding expiry of a dispute window. The human cannot override this by asking nicely. Neither can the agent.

## The Trust Primitive

Before any work begins, both parties commit to a cryptographic hash of the deal terms. That hash — the `terms_hash` — is the governing document for everything that follows. It cannot be revised. Neither party can fabricate a standard that was not present in the original terms. The hash is the source of truth.

This is not trust. It is proof.

## The Silence Rule

If the client does not raise a dispute within the review window, payment releases automatically. Silence is not ambiguity. It is acceptance. This eliminates the entire category of bad-faith delay — the passive-aggressive tactic of neither approving nor disputing while the worker waits indefinitely.

The 48-hour silence window is a novel obligation pattern: inaction is itself a binding act.

## The AI Layer

When a dispute is raised — or when delivery is submitted for evaluation — Claude evaluates the deliverable against the criteria that were locked in the `terms_hash`. The model is `specificity_not_quality`. It does not have opinions about whether the work is good. It checks whether the locked criteria were met.

The AI is not the arbiter of subjective quality. It is the executor of an explicit, pre-agreed specification. This is the correct role for AI in a trust-minimised enforcement system.

## Live in Production

- Base Sepolia escrow contract: `0x7a5c38be124c78da88D4C9F5ebEf72dC41869010`
- Telegram enforcement bot: running
- Discord bot: running
- Payment UI: live
- REST API: deployed on Railway

EQUALIZER is not a prototype. The enforcement layer is operational.
