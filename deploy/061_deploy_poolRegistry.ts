import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Warning
  // The proxy address should be changed with the new proxy 
  // deployed by Stake DAO with deploy 047
  // Changes need to be done on PoolRegistry.sol line 12

  await deploy("PoolREGISTRY", {
    contract: "PoolRegistry",
    from: deployer,
    args: [],
    log: true
  });
};
export default func;

func.skip = async () => false;
func.tags = ["PoolRegistry"];