import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const APW = "0x4104b135DBC9609Fc1A9490E61369036497660c8";
  const locker = ""; 
  const minter = "";
  const VE_APW = "0xC5ca1EBF6e912E49A6a70Bb0385Ea065061a4F09";

  await deploy("ApWineDEPOSITOR", {
    contract: "ApwineDepositor",
    from: deployer,
    args: [APW, locker, minter, VE_APW],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["ApWineDEPOSITOR"];
