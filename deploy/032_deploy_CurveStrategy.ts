import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const curveLocker = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";
  const governance = "0x5Ed111041CDd9D6B9356FB20A248Dbc7DF84eE0B";
  const multisigSD = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";
  const curveAcummulator = "0x54C7757199c4A04BCcD1472Ad396f768D8173757";
  const veSDTFeeCurveProxy = "";
  await deploy("CurveSTRATEGY", {
    contract: "CurveStrategy",
    from: deployer,
    args: [curveLocker, governance, multisigSD, curveAcummulator, veSDTFeeCurveProxy],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["CurveStrategy"];
