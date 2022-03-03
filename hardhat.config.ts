import { HardhatUserConfig, subtask } from "hardhat/config";

import fse from "fs-extra";
import path from "path";
import { TASK_COMPILE_GET_COMPILATION_TASKS } from "hardhat/builtin-tasks/task-names";

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
//import "./tasks/global";

require("dotenv").config();

const VYPER_TEMP_DIR = path.join(__dirname, "vyper_temp_dir");

subtask(TASK_COMPILE_GET_COMPILATION_TASKS, async (_, { config }, runSuper): Promise<string[]> => {
  await runSuper();

  // We save already compiled vyper artifacts
  const glob = await import("glob");
  const vyFiles = glob.sync(path.join(config.paths.artifacts, "**", "*.vy"));
  const vpyFiles = glob.sync(path.join(config.paths.artifacts, "**", "*.v.py"));
  const files = [...vyFiles, ...vpyFiles];

  await fse.remove(VYPER_TEMP_DIR);
  await fse.mkdir(VYPER_TEMP_DIR);
  for (const file of files) {
    const filename = file.replace(config.paths.artifacts + "/contracts/", "");
    await fse.move(file, path.join(VYPER_TEMP_DIR, filename));
  }

  return ["compile:solidity", "restore_vyper_artifacts", "compile:vyper"];
});

subtask<{ force: boolean }>("restore_vyper_artifacts", async (args, { config }) => {
  if (!args.force) {
    const dirs = await fse.readdir(VYPER_TEMP_DIR);

    for (const dir of dirs) {
      const destination = path.join(config.paths.artifacts, "contracts", dir);

      if (!fse.pathExists(destination)) {
        await fse.move(path.join(VYPER_TEMP_DIR, dir), path.join(config.paths.artifacts, "contracts", dir));
      } else {
        const files = await fse.readdir(path.join(VYPER_TEMP_DIR, dir));
        for (const file of files) {
          await fse.move(
            path.join(VYPER_TEMP_DIR, dir, file),
            path.join(config.paths.artifacts, "contracts", dir, file),
            {
              overwrite: true
            }
          );
        }
      }
    }
  }
  await fse.remove(VYPER_TEMP_DIR);
});

subtask("compile:vyper", async (_, { config, artifacts }) => {
  const { compile } = await import("./vyperCompile");
  const { generateVyperTypes } = await import("./vyperTypesGenerator");
  await compile(config.vyper, config.paths, artifacts);
  await generateVyperTypes();
});

export default {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET
        //blockNumber: 14133625
      }
    },
    mainnet: {
      url: process.env.MAINNET,
      accounts: [`0x${process.env.DEPLOYER_PKEY}`],
      gasPrice: 100000000000
    }
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
  }
} as HardhatUserConfig;
