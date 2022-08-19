import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  //const veSDTFraxProxy = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";

  await deploy("feeREGISTRY", {
    contract: "FeeRegistry",
    from: deployer,
    args: [],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["FeeRegistry"];