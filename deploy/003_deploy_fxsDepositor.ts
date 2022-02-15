import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const FXS = "0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0";
  const locker = await deployments.get("FXSLocker");
  const minter = await deployments.get("sdFXS");

  await deploy("FXSDepositor", {
    contract: "Depositor",
    from: deployer,
    args: [FXS, locker.address, minter.address],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["Depositor"];
func.dependencies = ["FXSLocker", "sdFXS"];
