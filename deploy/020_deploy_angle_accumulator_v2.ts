import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const agEUR = "0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8";

  await deploy("AngleAccumulatorV2", {
    contract: "AngleAccumulatorV2",
    from: deployer,
    args: [agEUR],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["AngleAccumulatorV2"];
