import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("AngleVaultFACTORY", {
    contract: "AngleVaultFactory",
    from: deployer,
    args: [],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["AngleVaultFactory"];
