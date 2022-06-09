import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, parseUnits } from "@ethersproject/units";
import BalancerHelperAbi from "./fixtures/BalancerHelper.json";
import { writeBalance } from "./utils";
import { Signer } from "ethers";
import { VE_SDT_BOOST_PROXY } from "./constant";
const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const ANGLE_HOLDER = "0x7bB909d58E54aba5596DFCaA873df0d50bC5d760";
const ANGLE_HOLDER_2 = "0x9843C8a8263308A309BfC3C2d1c308126D8E754D";

const BALANCER_HELPER = "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E";
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
const STETH_STABLE_POOL = "0x32296969Ef14EB0c6d29669C550D4a0449130230";
const STETH_STABLE_POOL_ID = "0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080";
const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const VESDTBOOST = "0xD67bdBefF01Fc492f1864E61756E5FBB3f173506";
const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("Balancer Strategy Vault", function () {
  let balancerHelper: Contract;
  let localDeployer: SignerWithAddress;
  let wsteth: Contract;
  let weth: Contract;
  let dummyMs: SignerWithAddress;
  let vault: Contract;
  let liquidityGauge: Contract;
  let deployer: JsonRpcSigner;
  let lpToken: Contract;
  before(async function () {
    [localDeployer, dummyMs] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });
    await writeBalance(WETH, "1000", localDeployer.address);
    await writeBalance(WSTETH, "1000", localDeployer.address);
    balancerHelper = await ethers.getContractAt(BalancerHelperAbi, BALANCER_HELPER);
    const vaultFactory = await ethers.getContractFactory("BalancerVault");
    const gaugeFactory = await ethers.getContractFactory("LiquidityGaugeV4Strat");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    vault = await vaultFactory.deploy();
    liquidityGauge = await gaugeFactory.deploy();
    await vault.init(STETH_STABLE_POOL, localDeployer.address, "vaultToken", "vaultToken");
    deployer = ethers.provider.getSigner(STDDEPLOYER);
    const proxyAdmin = await ProxyAdmin.deploy();
    const ABI = [
      "function initialize(address _staking_token,address _admin,address _SDT,address _voting_escrow,address _veBoost_proxy,address _distributor,address _vault,string memory _symbol)"
    ];

    const ifaceTwo = new ethers.utils.Interface(ABI);
    const liquidityGaugeImp = await gaugeFactory.deploy();
    const data = ifaceTwo.encodeFunctionData("initialize", [
      vault.address,
      localDeployer.address,
      SDT,
      VE_SDT,
      VE_SDT_BOOST_PROXY,
      dummyMs.address,
      vault.address,
      "gauge"
    ]);

    liquidityGauge = await Proxy.connect(deployer).deploy(liquidityGaugeImp.address, proxyAdmin.address, data);
    liquidityGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", liquidityGauge.address);
    // TOKEN CONTRACTS
    weth = await ethers.getContractAt("ERC20", WETH);
    wsteth = await ethers.getContractAt("ERC20", WSTETH);
    lpToken = await ethers.getContractAt("ERC20", STETH_STABLE_POOL);

    await vault.setLiquidityGauge(liquidityGauge.address);
  });
  it("it should be able to deposit with underlyin tokens", async () => {
    await wsteth.approve(vault.address, ethers.constants.MaxUint256);
    await weth.approve(vault.address, ethers.constants.MaxUint256);
    const minAmount = await balancerHelper.queryJoin(
      STETH_STABLE_POOL_ID,
      "0x2f8A4c329c9938b26231B81D23Ee76d38af2dD20",
      "0x2f8A4c329c9938b26231B81D23Ee76d38af2dD20",
      [
        [WSTETH, WETH],
        [ethers.utils.parseEther("1"), ethers.utils.parseEther("1")],
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256[]"],
          [1, [ethers.utils.parseEther("1"), ethers.utils.parseEther("1")]]
        ),
        false
      ]
    );
    await vault.deposit(
      localDeployer.address,
      0,
      false,
      true,
      [ethers.utils.parseEther("1"), ethers.utils.parseEther("1")],
      minAmount[0]
    );
    const keeperCut = minAmount[0].mul(10).div(10000);
    const expectedLiquidityGaugeTokenAmount = minAmount[0].sub(keeperCut);
    const lpBalanceAfter = await lpToken.balanceOf(vault.address);
    const gaugeTokenBalanceAfter = await liquidityGauge.balanceOf(localDeployer.address);
    expect(lpBalanceAfter, "Wrong lp amount in vault").to.be.eq(minAmount[0]);
    expect(gaugeTokenBalanceAfter, "Wrong accounting for liquidity gauge token").to.be.eq(
      expectedLiquidityGaugeTokenAmount
    );
  });
});
