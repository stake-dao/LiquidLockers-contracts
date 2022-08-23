import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const tokenReward = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" // WETH
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
