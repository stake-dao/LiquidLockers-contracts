import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // await deploy("veSDTImplementationNew", {
  //   contract: "veSDT",
  //   from: deployer,
  //   args: [],
  //   log: true
  // });

  //const proxyAdmin = await deployments.get("ProxyAdmin");
  //const veSdtProxy = await deployments.get("veSDT");
  //const veSDTImplementationNew = await deployments.get("veSDTImplementationNew");

  //console.log("veSdtProxy.address", veSdtProxy.address);
  //console.log("veSDTImplementationNew.address", veSDTImplementationNew.address);

  //await proxyAdmin.upgrade(veSdtProxy.address, veSDTImplementationNew.address);
};

export default func;

func.skip = async () => true;
func.tags = ["veSDTImplementationNew"];
func.dependencies = ["ProxyAdmin", "veSDT"];
