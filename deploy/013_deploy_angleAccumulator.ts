import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ANGLE = "0x31429d1856ad1377a8a0079410b297e1a9e214c2";

  await deploy("ANGLEAccumulator", {
    contract: "AngleAccumulator",
    from: deployer,
    args: [ANGLE],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["AngleAccumulator"];
