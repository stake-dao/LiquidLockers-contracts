import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const tokenName = "sdFXS";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyAdmin = await deployments.get("ProxyAdmin");
  const stakingToken = await deployments.get(tokenName);
  const veSDT = await deployments.get("veSDT");
  const veBoostProxy = await deployments.get("veBoostProxy");
  const admin = "0xb36a0671B3D49587236d7833B01E79798175875f"; // deployer
  const SDT = "0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F";

  await deploy(`LiquidityGaugeV4-${tokenName}-implementation`, {
    contract: "LiquidityGaugeV4",
    from: deployer,
    args: [],
    log: true
  });

  const gaugeImplementation = await deployments.get(`LiquidityGaugeV4-${tokenName}-implementation`);

  const ABI = [
    "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
  ];

  const iface = new hre.ethers.utils.Interface(ABI);

  const data = iface.encodeFunctionData("initialize", [
    stakingToken.address,
    admin,
    SDT,
    veSDT.address,
    veBoostProxy.address,
    admin // after call set_reward_distributor for SDT from deployer passing new SdtDistributor
  ]);

  await deploy(`LiquidityGaugeV4-${tokenName}`, {
    contract: "TransparentUpgradeableProxy",
    from: deployer,
    args: [gaugeImplementation.address, proxyAdmin.address, data],
    log: true
  });
};

export default func;

func.skip = async () => true;
func.tags = ["LiquidityGaugeV4"];
func.dependencies = ["veSDT", tokenName, "ProxyAdmin"];
