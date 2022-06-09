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
const LOCKER = "0xea79d1A83Da6DB43a85942767C389fE0ACf336A5";
const BALANCERACCUMULATOR = "0x9A211c972AebF2aE70F1ec14845848baAB79d6Af";
const STETH_STABLE_POOL = "0x32296969Ef14EB0c6d29669C550D4a0449130230";
const STETH_STABLE_POOL_ID = "0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080";
const OHM_DAI_WETH_POOL = "0xc45D42f801105e861e86658648e3678aD7aa70f9";
const OHM_DAI_WETH_POOL_ID = "0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e";
const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const OHM = "0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
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
  let balancerStrategy: Contract;
  let weightedPoolVault: Contract;
  let weightedPoolLiquidityGauge: Contract;
  let ohm: Contract;
  let dai: Contract;
  let ohmDaiWethLp: Contract;
  before(async function () {
    [localDeployer, dummyMs] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });
    await writeBalance(WETH, "1000", localDeployer.address);
    await writeBalance(WSTETH, "1000", localDeployer.address);
    await writeBalance(OHM, "1000", localDeployer.address);
    await writeBalance(DAI, "1000000", localDeployer.address);
    balancerHelper = await ethers.getContractAt(BalancerHelperAbi, BALANCER_HELPER);
    const vaultFactory = await ethers.getContractFactory("BalancerVault");
    const strategyFactory = await ethers.getContractFactory("BalancerStrategy");
    balancerStrategy = await strategyFactory.deploy(
      LOCKER,
      localDeployer.address,
      localDeployer.address,
      BALANCERACCUMULATOR,
      dummyMs.address,
      dummyMs.address
    );
    const gaugeFactory = await ethers.getContractFactory("LiquidityGaugeV4Strat");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    vault = await vaultFactory.deploy();
    weightedPoolVault = await vaultFactory.deploy();
    liquidityGauge = await gaugeFactory.deploy();
    await vault.init(STETH_STABLE_POOL, localDeployer.address, "vaultToken", "vaultToken", balancerStrategy.address);
    await weightedPoolVault.init(
      OHM_DAI_WETH_POOL,
      localDeployer.address,
      "vaultToken",
      "vaultToken",
      balancerStrategy.address
    );
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
    const dataTwo = ifaceTwo.encodeFunctionData("initialize", [
      weightedPoolVault.address,
      localDeployer.address,
      SDT,
      VE_SDT,
      VE_SDT_BOOST_PROXY,
      dummyMs.address,
      weightedPoolVault.address,
      "gauge"
    ]);
    weightedPoolLiquidityGauge = await Proxy.connect(deployer).deploy(
      liquidityGaugeImp.address,
      proxyAdmin.address,
      dataTwo
    );
    weightedPoolLiquidityGauge = await ethers.getContractAt(
      "LiquidityGaugeV4Strat",
      weightedPoolLiquidityGauge.address
    );
    // TOKEN CONTRACTS
    weth = await ethers.getContractAt("ERC20", WETH);
    wsteth = await ethers.getContractAt("ERC20", WSTETH);
    lpToken = await ethers.getContractAt("ERC20", STETH_STABLE_POOL);
    ohm = await ethers.getContractAt("ERC20", OHM);
    dai = await ethers.getContractAt("ERC20", DAI);
    ohmDaiWethLp = await ethers.getContractAt("ERC20", OHM_DAI_WETH_POOL);
    await vault.setLiquidityGauge(liquidityGauge.address);
    await weightedPoolVault.setLiquidityGauge(weightedPoolLiquidityGauge.address);
  });
  it("it should be able to deposit with underlying tokens", async () => {
    await wsteth.approve(vault.address, ethers.constants.MaxUint256);
    await weth.approve(vault.address, ethers.constants.MaxUint256);
    const minAmount = await balancerHelper.queryJoin(STETH_STABLE_POOL_ID, deployer._address, deployer._address, [
      [WSTETH, WETH],
      [ethers.utils.parseEther("1"), ethers.utils.parseEther("1")],
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256[]"],
        [1, [ethers.utils.parseEther("1"), ethers.utils.parseEther("1")]]
      ),
      false
    ]);
    await vault.provideLiquidityAndDeposit(
      localDeployer.address,
      false,
      [ethers.utils.parseEther("1"), ethers.utils.parseEther("1")],
      minAmount[0]
    );
    const keeperCut = minAmount[0].mul(10).div(10000);
    const expectedLiquidityGaugeTokenAmount = minAmount[0].sub(keeperCut);
    const lpBalanceAfter = await lpToken.balanceOf(vault.address);
    const gaugeTokenBalanceAfter = await liquidityGauge.balanceOf(localDeployer.address);
    const wethBalanceOfVault = await weth.balanceOf(vault.address);
    const wstethBalanceOfVault = await wsteth.balanceOf(vault.address);
    expect(lpBalanceAfter, "Wrong lp amount in vault").to.be.eq(minAmount[0]);
    expect(gaugeTokenBalanceAfter, "Wrong accounting for liquidity gauge token").to.be.eq(
      expectedLiquidityGaugeTokenAmount
    );
    expect(wethBalanceOfVault).to.be.eq(0);
    expect(wstethBalanceOfVault).to.be.eq(0);
  });

  it("it should be able to deposit with underlying tokens to weighted pool", async () => {
    await ohm.approve(weightedPoolVault.address, ethers.constants.MaxUint256);
    await dai.approve(weightedPoolVault.address, ethers.constants.MaxUint256);
    await weth.approve(weightedPoolVault.address, ethers.constants.MaxUint256);
    const minAmount = await balancerHelper.queryJoin(OHM_DAI_WETH_POOL_ID, deployer._address, deployer._address, [
      [OHM, DAI, WETH],
      [ethers.utils.parseEther("10"), ethers.utils.parseEther("170"), ethers.utils.parseEther("1")],
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256[]"],
        [1, [ethers.utils.parseEther("10"), ethers.utils.parseEther("170"), ethers.utils.parseEther("1")]]
      ),
      false
    ]);
    await weightedPoolVault.provideLiquidityAndDeposit(
      localDeployer.address,
      false,
      [ethers.utils.parseEther("10"), ethers.utils.parseEther("170"), ethers.utils.parseEther("1")],
      minAmount[0]
    );
    const keeperCut = minAmount[0].mul(10).div(10000);
    const expectedLiquidityGaugeTokenAmount = minAmount[0].sub(keeperCut);
    const gaugeTokenBalanceAfter = await weightedPoolLiquidityGauge.balanceOf(localDeployer.address);

    const lpBalanceAfter = await ohmDaiWethLp.balanceOf(weightedPoolVault.address);
    const wethBalanceOfVault = await weth.balanceOf(weightedPoolVault.address);
    const daiBalanceOfVault = await dai.balanceOf(weightedPoolVault.address);
    const ohmBalanceOfVault = await ohm.balanceOf(weightedPoolVault.address);
    expect(lpBalanceAfter, "Wrong lp amount in vault").to.be.eq(minAmount[0]);
    expect(wethBalanceOfVault).to.be.eq(0);
    expect(daiBalanceOfVault).to.be.eq(0);
    expect(ohmBalanceOfVault).to.be.eq(0);
    expect(gaugeTokenBalanceAfter, "Wrong accounting for liquidity gauge token").to.be.eq(
      expectedLiquidityGaugeTokenAmount
    );
  });
});
