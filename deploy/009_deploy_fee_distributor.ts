import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const veSDT = await deployments.get("veSDT");
  const TOKEN = "0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7"; // sdFRAX3CRV-f
  const startTime = "1642957200";
  const admin = deployer;
  const emergencyReturn = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063"; // multisig

  await deploy("FeeDistributor", {
    from: deployer,
    args: [veSDT.address, startTime, TOKEN, admin, emergencyReturn],
    log: true
  });
};
export default func;

func.tags = ["FeeDistributor"];
func.dependencies = ["veSDT"];
