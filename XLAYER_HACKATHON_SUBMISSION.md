# EQUALIZER — X Layer Hackathon Submission

## Project Info
- **Name:** EQUALIZER
- **Repo:** https://github.com/ronkenx9/equalizer
- **Bot:** [@EqualizerThebot](https://t.me/EqualizerThebot)
- **Chain:** X Layer Mainnet (chainId 196)

## Deployed Contract
- **Escrow Contract:** `0x02a51207f114b47DED4fa1597639344747eb4b4D`
- **Explorer:** [View on OKX Explorer](https://www.okx.com/web3/explorer/xlayer/address/0x02a51207f114b47DED4fa1597639344747eb4b4D)

## Verified Transaction
- **Tx Hash:** `0x817b08aac7cf1f76f3cceb632456f28e867fc31bd394b5bc5e00e46ae5fcf9a7`
- **Explorer:** [View Tx](https://www.okx.com/web3/explorer/xlayer/tx/0x817b08aac7cf1f76f3cceb632456f28e867fc31bd394b5bc5e00e46ae5fcf9a7)
- **Block:** 55875260
- **Action:** Deal created with 0.001 OKB deposit into escrow

## Architecture Summary

EQUALIZER is a multi-chain AI agent that enforces freelance deals in chat:

1. **Telegram Bot** detects deal intent from natural conversation using Groq (Llama 3.3 70B)
2. **AI Agent** structures terms, creates onchain escrow, and generates a payment link
3. **Smart Contract** (Solidity, ReentrancyGuard) holds funds with configurable dispute windows
4. **Payment UI** (React + RainbowKit + wagmi) lets brands deposit directly
5. **Auto-Release** — silence after the dispute window = payment released. No human needed.

### Multi-Chain Support
| Feature | Base Sepolia | X Layer Mainnet |
|---------|-------------|-----------------|
| Escrow Contract | ✅ | ✅ |
| Deal Creation | ✅ | ✅ |
| Auto-Release | ✅ | ✅ |
| EAS Attestations | ✅ | ❌ (not available) |
| Pimlico Delegation | ✅ | ❌ (not supported) |

### Tech Stack
- **Bot:** TypeScript, Grammy.js, Groq AI
- **Contracts:** Solidity 0.8.24, Hardhat, OpenZeppelin
- **Payment UI:** React, Vite, wagmi, RainbowKit
- **Agent:** viem, ethers.js, Claude/Venice AI

## Submission Checklist
- [x] Open-source repo
- [x] Deployed contract on X Layer Testnet
- [x] Verified transaction hash
- [x] Multi-chain architecture (Base + X Layer)
- [x] AGENTS.md in repo root
- [x] agent.json with full tool manifest
- [x] Telegram bot live
