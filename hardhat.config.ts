import { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-vyper";

import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "@nomiclabs/hardhat-solhint";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@typechain/hardhat";

require("dotenv").config();

export default {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET,
        //blockNumber: 15374400
      }
    },
    mainnet: {
      url: process.env.MAINNET,
      accounts: [`0x${process.env.DEPLOYER_PKEY}`]
    }
  },
  namedAccounts: {
    deployer: 0
  },
  vyper: {
    version: "0.2.16"
  },
  solidity: {
    compilers: [
    {
      version: "0.8.7",
      settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }},
    {
      version: "0.6.12",
      settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
      }
    }

  ]

  },
  gasReporter: {
    enabled: false,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_KEY
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true
  },
  mocha: {
    timeout: 100000000
  }
} as HardhatUserConfig;
