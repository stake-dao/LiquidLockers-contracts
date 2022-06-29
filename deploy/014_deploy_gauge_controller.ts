import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const SDT = "0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F";
  const veSDT = await deployments.get("veSDT");
  const admin = "0xb36a0671B3D49587236d7833B01E79798175875f"; // deployer

  await deploy("GaugeController", {
    from: deployer,
    args: [SDT, veSDT.address, admin],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["GaugeController"];
func.dependencies = ["veSDT"];
