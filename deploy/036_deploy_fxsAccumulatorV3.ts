import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const FXS = "0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0";
  const gauge = "0xF3C6e8fbB946260e8c2a55d48a5e01C82fD63106";
  await deploy("FXSAccumulator", {
    contract: "FxsAccumulator",
    from: deployer,
    args: [FXS, gauge],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["FxsAccumulator"];
