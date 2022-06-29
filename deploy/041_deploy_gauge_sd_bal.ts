import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyAdmin = "0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B";
  const stakingToken = "0xF24d8651578a55b0C119B9910759a351A3458895"; // sdBal
  const veSDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
  const veBoostProxy = "0xD67bdBefF01Fc492f1864E61756E5FBB3f173506";
  const admin = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8"; // new deployer
  const SDT = "0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F";
  const GAUGE_IMPL = "0x93c951D3281Cc79e9FE1B1C87e50693D202F4C17"; // sdAngle LGV4 impl
  const sdtDistributor = "0x8Dc551B4f5203b51b5366578F42060666D42AB5E"; // LL SdtDistributorV2

  const ABI = [
    "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
  ];

  const iface = new hre.ethers.utils.Interface(ABI);

  const data = iface.encodeFunctionData("initialize", [stakingToken, admin, SDT, veSDT, veBoostProxy, sdtDistributor]);

  await deploy(`LiquidityGaugeV4-sdBAL`, {
    contract: "TransparentUpgradeableProxy",
    from: deployer,
    args: [GAUGE_IMPL, proxyAdmin, data],
    log: true
  });
};

export default func;

func.skip = async () => true;
func.tags = ["LiquidityGaugeV4"];
