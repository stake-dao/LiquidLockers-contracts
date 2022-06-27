import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52";
  const CRV_LOCKER = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";
  const minter = await deployments.get("sdCRV");

  await deploy("CrvDepositor", {
    from: deployer,
    args: [CRV, CRV_LOCKER, minter.address],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["CrvDepositor"];
func.dependencies = ["sdCRV"];
