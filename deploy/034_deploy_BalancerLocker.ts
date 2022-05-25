import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const STAKE_DAO_MULTISIG = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("BalancerLocker", {
    contract: "BalancerLocker",
    from: deployer,
    args: [STAKE_DAO_MULTISIG],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["BalancerLocker"];
