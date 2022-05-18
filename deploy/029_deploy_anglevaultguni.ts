import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const token = "0x857E0B2eD0E82D5cDEB015E77ebB873C47F99575";
  const governance = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
  const name = "Stake DAO GUniAgeur/ETH Vault";
  const symbol = "sdGUniAgeur/ETH-vault";
  const angleStrategy = "0x22635427C72e8b0028FeAE1B5e1957508d9D7CAF";
  await deploy("AngleVaultGUNI-ageur/weth", {
    contract: "AngleVaultGUni",
    from: deployer,
    args: [token, governance, name, symbol, angleStrategy],
    log: true
  });
};
export default func;

func.skip = async () => false;
func.tags = ["AngleVaultGUni"];
