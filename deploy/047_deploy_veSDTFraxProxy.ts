import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
  const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";

  const dep = await deploy("veSDTFeeFraxPROXY", {
    contract: "veSDTFeeFraxProxy",
    from: deployer,
    args: [[FXS, FRAX]],
    log: true
  });
  console.log(dep)
};
export default func;

func.skip = async () => true;
func.tags = ["veSDTFeeFraxProxy"];