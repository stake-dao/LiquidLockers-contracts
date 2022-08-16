import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const gauge = ""; // to add after the deploy

  await deploy("LENDFLAREAccumulator", {
    contract: "LftAccumulator",
    from: deployer,
    args: [gauge],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["LENDFLAREAccumulator"];
