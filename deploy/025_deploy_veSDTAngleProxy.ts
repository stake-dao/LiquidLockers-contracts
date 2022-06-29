import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const ANGLE = "0x31429d1856aD1377A8A0079410B297e1a9e214c2";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
  const SUSHI = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2";

  await deploy("veSDTFeeAnglePROXY", {
    contract: "veSDTFeeAngleProxy",
    from: deployer,
    args: [[ANGLE, WETH, SUSHI, FRAX]],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["veSDTFeeAngleProxy"];
