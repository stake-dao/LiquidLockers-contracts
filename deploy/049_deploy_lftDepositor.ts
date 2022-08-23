import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const LFT = "0xB620Be8a1949AA9532e6a3510132864EF9Bc3F82";
  const locker = "0xD059575A78508B02e89ef9Ae0c1b409b07853d37"; 
  const minter = "0x0879c1a344910c2944C29b892A1CF0c216122C66";

  await deploy("LendFlareDEPOSITOR", {
    contract: "Depositor",
    from: deployer,
    args: [LFT, locker, minter],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["LendFlareDEPOSITOR"];
