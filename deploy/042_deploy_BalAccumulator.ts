import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const BAL = "0xba100000625a3754423978a60c9317c58a424e3D";
  const gauge = "0x3E8C72655e48591d93e6dfdA16823dB0fF23d859";

  await deploy("BALANCERAccumulator", {
    contract: "BalancerAccumulator",
    from: deployer,
    args: [BAL, gauge],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["BalancerAccumulator"];
