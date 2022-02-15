import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ZERO = "0x0000000000000000000000000000000000000000";
  const veSDT = await deployments.get("veSDT");
  const admin = "0xb36a0671B3D49587236d7833B01E79798175875f"; // deployer

  await deploy("veBoostProxy", {
    from: deployer,
    args: [veSDT.address, ZERO, admin],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["veBoostProxy"];
func.dependencies = ["veSDT"];
