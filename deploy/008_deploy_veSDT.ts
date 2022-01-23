import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("ProxyAdmin", {
    from: deployer,
    args: [],
    log: true
  });

  await deploy("veSDTImplementation", {
    contract: "veSDT",
    from: deployer,
    args: [],
    log: true
  });

  const sww = await deployments.get("SmartWalletWhitelist");
  const proxyAdmin = await deployments.get("ProxyAdmin");
  const veSDTImplementation = await deployments.get("veSDTImplementation");

  const ABI = [
    "function initialize(address _admin, address token_addr, address _smart_wallet_checker, string _name, string _symbol)"
  ];

  const iface = new hre.ethers.utils.Interface(ABI);
  const data = iface.encodeFunctionData("initialize", [deployer, SDT, sww.address, "Vote-escrowed SDT", "veSDT"]);

  await deploy("veSDT", {
    contract: "TransparentUpgradeableProxy",
    from: deployer,
    args: [veSDTImplementation.address, proxyAdmin.address, data],
    log: true
  });

  // const veSDT = await deployments.get("veSDT");
  // const veSDTContract = await hre.ethers.getContractAt(veSDTImplementation.abi, veSDT.address);
  // const initialized = await veSDTContract.initialized();
  // const admin = await veSDTContract.admin();

  // if (initialized) {
  //   console.log(`veSDT initialized with admin : ${admin}`);
  // }
};

export default func;

func.tags = ["veSDT"];
func.dependencies = ["SmartWalletWhitelist"];
