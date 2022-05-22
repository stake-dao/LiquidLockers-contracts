import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const token = "0xEDECB43233549c51CC3268b5dE840239787AD56c";
  const governance = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
  const name = "Stake DAO GUniAgeur/USDC Vault";
  const symbol = "sdGUniAgeur/USDC-vault";
  const angleStrategy = "0x22635427C72e8b0028FeAE1B5e1957508d9D7CAF";
  const scalingFactor = "991386710024824636";
  await deploy("AngleVaultGUNI", {
    contract: "AngleVaultGUni",
    from: deployer,
    args: [token, governance, name, symbol, angleStrategy, scalingFactor],
    log: true
  });
};
export default func;

func.skip = async () => true;
func.tags = ["AngleVaultGUni"];
