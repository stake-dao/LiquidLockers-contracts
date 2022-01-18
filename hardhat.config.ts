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
//import "./tasks/global";

require("dotenv").config();

export default {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET
      }
    },
    mainnet: {
      url: process.env.MAINNET,
      accounts: [`0x${process.env.DEPLOYER_PKEY}`],
      gasPrice: 225000000000
    }
  },
  namedAccounts: {
    deployer: 0
  },
  vyper: {
    version: "0.2.7"
  },
  solidity: {
    compilers: [{ version: "0.8.7" }],
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
  }
} as HardhatUserConfig;
