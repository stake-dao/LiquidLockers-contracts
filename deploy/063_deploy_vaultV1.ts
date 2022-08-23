import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("VaultV1", {
    contract: "VaultV1",
    from: deployer,
    args: [],
    log: true
  });
};
export default func;

// Don't forget to read the warning
func.skip = async () => true;
// Don't forget to read the warning
func.tags = ["VaultV1"];