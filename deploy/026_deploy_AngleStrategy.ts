import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const angleLocker = "0xD13F8C25CceD32cdfA79EB5eD654Ce3e484dCAF5";
  const governance = "0x5Ed111041CDd9D6B9356FB20A248Dbc7DF84eE0B";
  const multisigSD = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";
  const angleAcummulator = "0x943671e6c3A98E28ABdBc60a7ac703b3c0C6aA51";
  const veSDTFeeAngleProxy = "0xE92Aa77c3D8c7347950B2a8d4B2A0AdBF0c31054";
  await deploy("AngleSTRATEGY", {
    contract: "AngleStrategy",
    from: deployer,
    args: [angleLocker, governance, multisigSD, angleAcummulator, veSDTFeeAngleProxy],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["AngleStrategy"];
