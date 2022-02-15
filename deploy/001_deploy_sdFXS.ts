import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("sdFXS", {
    contract: "sdToken",
    args: ["Stake DAO FXS", "sdFXS"],
    from: deployer,
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["sdToken"];
