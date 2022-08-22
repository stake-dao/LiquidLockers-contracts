import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const tokenReward = "0x0eC9F76202a7061eB9b3a7D6B59D36215A7e37da" // BPT
  const gauge = "";

  await deploy("BlackpoolAccumulator", {
    contract: "BlackpoolAccumulator",
    from: deployer,
    args: [tokenReward, gauge],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["BlackpoolAccumulator"];
