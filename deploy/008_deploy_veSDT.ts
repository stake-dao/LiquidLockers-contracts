import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
  const smartwhitelist = await deployments.get("SmartWalletWhitelist");

  await deploy("veSDT", {
    from: deployer,
    args: [deployer, SDT, smartwhitelist.address, "Vote-escrowed SDT", "veSDT"],
    log: true
  });
};
export default func;

func.tags = ["veSDT"];
func.dependencies = ["SmartWalletWhitelist"];
