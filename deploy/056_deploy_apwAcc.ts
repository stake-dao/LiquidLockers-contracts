import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const gauge = "";

  await deploy("ApWineAccumulator", {
    contract: "ApwineAccumulator",
    from: deployer,
    args: [gauge],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["ApWineAccumulator"];
