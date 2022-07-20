import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const LFT = "0xB620Be8a1949AA9532e6a3510132864EF9Bc3F82";
  const locker = ""; // to add after deploy it
  const minter = ""; // to add after deploy it

  await deploy("LendFlareDEPOSITOR", {
    contract: "Depositor",
    from: deployer,
    args: [LFT, locker, minter],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["LendFlareDEPOSITOR"];
