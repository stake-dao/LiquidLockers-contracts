import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const curveLocker = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";
  const governance = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
  const multisigSD = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";
  const curveAcummulator = "0x54C7757199c4A04BCcD1472Ad396f768D8173757";
  const veSDTFeeCurveProxy = "0x200058AB20Fef357414fC39Cab827ec35643c585";
  const sdtDistributor = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
  await deploy("CurveSTRATEGY", {
    contract: "CurveStrategy",
    from: deployer,
    args: [curveLocker, governance, multisigSD, curveAcummulator, veSDTFeeCurveProxy, sdtDistributor],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["CurveStrategy"];
