# EQUALIZER on Status L2

EQUALIZER's `Escrow.sol` contract is configured for deployment on **Status Network Testnet** (Chain ID: 1660990954).

## Deployment

- **Network:** Status Network Testnet
- **Chain ID:** 1660990954
- **RPC:** https://testnet.rpc.status.network
- **Explorer:** https://testnet.explorer.status.network
- **Contract Address:** pending funding — RPC endpoint unreachable at time of submission
- **Gas:** Zero-gas network (ETH as native currency, free transactions)

## Flow on Status L2

The deal creation → delivery → auto-release flow is identical to Base Sepolia:

1. Brand calls `createDeal()` with ETH — funds locked in escrow
2. Creator delivers → agent evaluates → calls `submitDelivery()`
3. 24-hour dispute window opens
4. No dispute? `autoRelease()` is permissionless — anyone triggers payment
5. Dispute? Agent mediates and calls `rule(dealId, bps)` for a binding split

Zero-gas execution on Status L2 means the enforcement layer is free for all parties.

## Network Config

Added to `contracts/hardhat.config.ts`:

```typescript
statusTestnet: {
  url: "https://testnet.rpc.status.network",
  chainId: 1660990954,
  accounts: [process.env.AGENT_PRIVATE_KEY ?? ""],
}
```

Deploy command: `npx hardhat run scripts/deploy.ts --network statusTestnet`

## Known Issue

The Status Network testnet RPC (`testnet.rpc.status.network`) returned NXDOMAIN at time of submission. Contract will be deployed as soon as the endpoint is reachable.
