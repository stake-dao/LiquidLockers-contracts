import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const tokenName = "G-UNI";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyAdmin = "0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B";
  const vault = "0x4Ca321E4966A6BCbC26c13921CD76cac7D1f1B02";
  const admin = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8"; // deployer
  const SDT = "0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F";
  const veSDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
  const veBOOST = "0xD67bdBefF01Fc492f1864E61756E5FBB3f173506";
  const distributor = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
  const symbol = "G-UNI";
  const gaugeImplementation = "0x3Dc56D46F0Bd13655EfB29594a2e44534c453BF9";

  const ABI = [
    "function initialize(address _staking_token,address _admin,address _SDT,address _voting_escrow,address _veBoost_proxy,address _distributor,address _vault,string memory _symbol)"
  ];

  const iface = new hre.ethers.utils.Interface(ABI);

  const data = iface.encodeFunctionData("initialize", [vault, admin, SDT, veSDT, veBOOST, distributor, vault, symbol]);

  await deploy(`LiquidityGaugeV4-${tokenName}`, {
    contract: "TransparentUpgradeableProxy",
    from: deployer,
    args: [gaugeImplementation, proxyAdmin, data],
    log: true
  });
};

export default func;

func.skip = async () => true;
func.tags = ["LiquidityGaugeV4"];
