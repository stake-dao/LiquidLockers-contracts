import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ANGLE = "0x31429d1856ad1377a8a0079410b297e1a9e214c2";
  const locker = await deployments.get("ANGLELocker");
  const minter = await deployments.get("sdANGLE");

  await deploy("ANGLEDepositor", {
    contract: "Depositor",
    from: deployer,
    args: [ANGLE, locker.address, minter.address],
    log: true
  });
};
export default func;

func.tags = ["Depositor"];
func.dependencies = ["ANGLELocker", "sdANGLE"];
