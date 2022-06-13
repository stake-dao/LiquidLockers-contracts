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
import "hardhat-gas-reporter";
import { HardhatUserConfig, task } from "hardhat/config";

require("dotenv").config();

export default {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET,
        blockNumber: 15346196
      }
    } /*
    mainnet: {
      url: process.env.MAINNET,
      accounts: [`0x${process.env.DEPLOYER_PKEY}`],
      gasPrice: 100000000000
    }*/
  },
  namedAccounts: {
    deployer: 0
  },
  vyper: {
    version: "0.2.16"
  },
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
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
