import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const balancerLocker = "0xea79d1A83Da6DB43a85942767C389fE0ACf336A5";
  const governance = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
  const multisigSD = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";
  const balancerAcummulator = "0x9A211c972AebF2aE70F1ec14845848baAB79d6Af";
  const veSDTFeeBalancerProxy = ""; // add it after the deploy (script 44)
  const sdtDistributor = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
  await deploy("BalancerSTRATEGY", {
    contract: "BalancerStrategy",
    from: deployer,
    args: [balancerLocker, governance, multisigSD, balancerAcummulator, veSDTFeeBalancerProxy, sdtDistributor],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["BalancerStrategy"];
