import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const SUSHI = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2";
  const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";

  await deploy("veSDTFeeCurvePROXY", {
    contract: "veSDTFeeCurveProxy",
    from: deployer,
    args: [[CRV, WETH, SUSHI, FRAX]],
    log: true
  });
};
export default func;

func.skip = async () => false;
func.tags = ["veSDTFeeCurveProxy"];
