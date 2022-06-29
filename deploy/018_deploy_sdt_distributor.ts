import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyAdmin = await deployments.get("ProxyAdmin");

  await deploy(`SdtDistributor-implementation`, {
    contract: "SdtDistributor",
    from: deployer,
    args: [],
    log: true
  });

  const sdtDistributorImplementation = await deployments.get(`SdtDistributor-implementation`);
  const gaugeController = await deployments.get(`GaugeController`);

  const ABI = [
    "function initialize(address _rewardToken, address _controller, address _masterchef, address _governor, address _guardian, address _delegateGauge)"
  ];

  const iface = new hre.ethers.utils.Interface(ABI);

  const rewardToken = "0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F";
  const masterchef = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";
  const governor = "0xb36a0671B3D49587236d7833B01E79798175875f";
  const guardian = "0xb36a0671B3D49587236d7833B01E79798175875f";
  const delegateGauge = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";

  const data = iface.encodeFunctionData("initialize", [
    rewardToken,
    gaugeController.address,
    masterchef,
    governor,
    guardian,
    delegateGauge
  ]);

  await deploy(`SdtDistributor`, {
    contract: "TransparentUpgradeableProxy",
    from: deployer,
    args: [sdtDistributorImplementation.address, proxyAdmin.address, data],
    log: true
  });
};

export default func;

func.skip = async () => true;
func.tags = ["SdtDistributor"];
func.dependencies = ["ProxyAdmin", "GaugeController"];
