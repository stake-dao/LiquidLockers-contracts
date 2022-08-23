import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const LOCKER = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f";
  const POOL_REGISTRY = "0x3051Cc7114C07365C99cF82DE13CD9d10e603a4A";
  const FRAX_STRATEGY = "0xf285Dec3217E779353350443fC276c07D05917c3";

  await deploy("BOOSTER", {
    contract: "Booster",
    from: deployer,
    args: [LOCKER, POOL_REGISTRY, FRAX_STRATEGY],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["Booster"];