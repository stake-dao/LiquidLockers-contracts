import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const THREE_CRV = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
  const gauge = "0x7f50786A0b15723D741727882ee99a0BF34e3466";

  await deploy("CURVEAccumulator", {
    contract: "CurveAccumulator",
    from: deployer,
    args: [THREE_CRV, gauge],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["CurveAccumulator"];
