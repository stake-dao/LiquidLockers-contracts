import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const SAN_USDC_EUR = "0x9C215206Da4bf108aE5aEEf9dA7caD3352A36Dad";
  const gauge = "0xE55843a90672f7d8218285e51EE8fF8E233F35d5";

  await deploy("ANGLEAccumulator", {
    contract: "AngleAccumulatorV3",
    from: deployer,
    args: [SAN_USDC_EUR, gauge],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["AngleAccumulatorV3"];
