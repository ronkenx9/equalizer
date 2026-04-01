import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_TESTNET_RPC ?? "https://sepolia.base.org",
      accounts: process.env.AGENT_PRIVATE_KEY ? [process.env.AGENT_PRIVATE_KEY] : [],
      chainId: 84532,
    },
    statusTestnet: {
      url: "https://testnet.rpc.status.network",
      chainId: 1660990954,
      accounts: [process.env.AGENT_PRIVATE_KEY ?? ""],
    },
    xlayer: {
      url: process.env.XLAYER_RPC ?? "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: process.env.AGENT_PRIVATE_KEY ? [process.env.AGENT_PRIVATE_KEY] : [],
    },
    flowTestnet: {
      url: process.env.FLOW_TESTNET_RPC ?? "https://testnet.evm.nodes.onflow.org",
      chainId: 545,
      accounts: process.env.FLOW_PRIVATE_KEY ? [process.env.FLOW_PRIVATE_KEY] : (process.env.AGENT_PRIVATE_KEY ? [process.env.AGENT_PRIVATE_KEY] : []),
    },
  },
  etherscan: {
    apiKey: process.env.BASESCAN_API_KEY ?? "",
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=84532",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
};

export default config;
