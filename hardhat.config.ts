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
  namedAccounts: {
    deployer: 0
  },
  vyper: {
    compilers: [{ version: "0.2.16" }, { version: "0.3.4" }, { version: "0.2.15" }, { version: "0.3.3" }]
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
        }
      },
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
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true
  },
  mocha: {
    timeout: 100000000
  },
  // specify separate cache for hardhat, since it could possibly conflict with foundry's
  paths: {
    cache: "hh-cache"
  }
} as HardhatUserConfig;
