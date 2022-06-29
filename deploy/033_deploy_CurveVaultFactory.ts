import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const gaugeImp = "0x3Dc56D46F0Bd13655EfB29594a2e44534c453BF9";
  const curveStrategy = "0x20F1d4Fed24073a9b9d388AfA2735Ac91f079ED6";
  const sdtDistributor = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
  await deploy("CurveVaultFACTORY", {
    contract: "CurveVaultFactory",
    from: deployer,
    args: [gaugeImp, curveStrategy, sdtDistributor],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["CurveVaultFactory"];
