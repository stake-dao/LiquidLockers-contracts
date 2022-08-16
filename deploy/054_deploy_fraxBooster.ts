import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const LOCKER = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f";
  const POOL_REGISTRY = "0x0000000000000000000000000000000000000001"; // Need deploy 050
  const FRAX_STRATEGY = "0x0000000000000000000000000000000000000001"; // Need deploy 053

  await deploy("BOOSTER", {
    contract: "Booster",
    from: deployer,
    args: [LOCKER,POOL_REGISTRY,FRAX_STRATEGY],
    log: true
  });
};
export default func;

func.skip = async () => false;
func.tags = ["Booster"];