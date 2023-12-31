import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const LOCKER = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f";
  const GOVERNANCE = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
  const ACCUMULATOR = "0xF980B8A714Ce0cCB049f2890494b068CeC715c3f";
  const VE_SDT_FEE_PROXY = "0x86Ebcd1bC876782670FE0B9ea23d8504569B9ffc";
  const SDT_DISTRIBUTOR = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
  const RECEIVER = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063"; // Stake DAO MS

  await deploy("FraxSTRATEGY", {
    contract: "FraxStrategy",
    from: deployer,
    args: [LOCKER, GOVERNANCE, ACCUMULATOR, VE_SDT_FEE_PROXY, SDT_DISTRIBUTOR, RECEIVER],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["FraxStrategy"];