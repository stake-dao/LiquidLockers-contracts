import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const balancerStrategy = "0x873b031Ea6E4236E44d933Aae5a66AF6d4DA419d";
  await deploy("BalancerVaultFACTORY", {
    contract: "BalancerVaultFactory",
    from: deployer,
    args: [balancerStrategy],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["BalancerVaultFactory"];
