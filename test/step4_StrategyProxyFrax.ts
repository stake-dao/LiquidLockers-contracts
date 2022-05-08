import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { parseEther, parseUnits } from "@ethersproject/units";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import FxsLockerABI from "./fixtures/FXSLocker.json";
import FxsTempleGaugeFraxABI from "./fixtures/FxsTempleGaugeFrax.json"
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import ERC20ABI from "./fixtures/ERC20.json";
import FXSABI from "./fixtures/FXS.json";
import { info } from "console";
import exp from "constants";
import { type } from "os";

/* ==== Time ==== */
const DAY = 60 * 60 * 24;
const WEEK = 60 * 60 * 24 * 7;
const YEAR = 60 * 60 * 24 * 364;
const MAXLOCK = 3 * 60 * 60 * 24 * 364;


/* ==== Address ==== */
const NULL = "0x0000000000000000000000000000000000000000"
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const VESDT_HOLDER = "0xdceb0bb3311342e3ce9e49f57affce9deac40ba1";
const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const FXS_TEMPLE = "0x6021444f1706f15465bEe85463BCc7d7cC17Fc03";
const FXS_TEMPLE_GAUGE = "0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16";
const FXS_TEMPLE_HOLDER = "0xa5f74ae4b22a792f18c42ec49a85cf560f16559f"

const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";
const FXSACCUMULATOR = "0x1CC16bEdaaCD15848bcA5eB80188e0931bC59fB2"
const FXSLOCKER = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

describe("FRAX Strategy", function () {
  let localDeployer: SignerWithAddress;
  let dummyMs: SignerWithAddress;

  let deployer: JsonRpcSigner;
  let LPHolder: JsonRpcSigner;
  let timelock: JsonRpcSigner;
  let veSdtHolder: JsonRpcSigner;

  let locker: Contract;
  let fxsTemple: Contract;
  let frax: Contract;
  let fxs: Contract;
  let sdt: Contract;
  let VeSdtProxy: Contract;
  let masterchef: Contract;
  let sdtDistributor: Contract;
  let gc: Contract;
  let sdtDProxy: Contract;
  let strategy: Contract;
  let fraxVaultFactoryContract: Contract;
  let fxsTempleVault: Contract;
  let fxsTempleMultiGauge: Contract;
  let fxsTempleLiqudityGauge: Contract;
  let fxsTempleGaugeFrax: Contract;

  before(async function () {

    /* ==== Get Signer ====*/
    [localDeployer, dummyMs] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FXS_TEMPLE_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [TIMELOCK]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [VESDT_HOLDER]
    });
    deployer = ethers.provider.getSigner(STDDEPLOYER);
    LPHolder = ethers.provider.getSigner(FXS_TEMPLE_HOLDER);
    timelock = ethers.provider.getSigner(TIMELOCK);
    veSdtHolder = ethers.provider.getSigner(VESDT_HOLDER);
    await network.provider.send("hardhat_setBalance", [STDDEPLOYER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [FXS_TEMPLE_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [VESDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [TIMELOCK, ETH_100]);

    /* ==== Get Contract Factory ==== */
    const FraxStrategy = await ethers.getContractFactory("FraxStrategy");
    const SdtDistributor = await ethers.getContractFactory("SdtDistributorV2");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const veSdtAngleProxyFactory = await ethers.getContractFactory("veSDTFeeFraxProxy");
    const liquidityGaugeFactory = await ethers.getContractFactory("LiquidityGaugeV4Strat");
    const fraxVaultFactory = await ethers.getContractFactory("FraxVaultFactory");

    /* ==== Get Contract At ==== */
    locker = await ethers.getContractAt(FxsLockerABI, FXSLOCKER);
    fxsTempleGaugeFrax = await ethers.getContractAt(FxsTempleGaugeFraxABI, FXS_TEMPLE_GAUGE);
    fxsTemple = await ethers.getContractAt(ERC20ABI, FXS_TEMPLE)
    frax = await ethers.getContractAt(ERC20ABI, FRAX);
    fxs = await ethers.getContractAt(FXSABI, FXS)
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);

    /* ==== Deploy ==== */
    VeSdtProxy = await veSdtAngleProxyFactory.deploy([FXS, WETH, FRAX]);
    const proxyAdmin = await ProxyAdmin.deploy();
    sdtDistributor = await SdtDistributor.deploy();
    const liquidityGaugeStratImp = await liquidityGaugeFactory.deploy();


    /* Deployed quick and dirty */
    let ABI_SDTD = [
      "function initialize(address _rewardToken, address _controller, address _masterchef, address governor, address guardian, address _delegate_gauge)"
    ];
    let iface = new ethers.utils.Interface(ABI_SDTD);
    gc = await GaugeController.connect(deployer).deploy(SDT, VE_SDT, deployer._address);
    const dataSdtD = iface.encodeFunctionData("initialize", [
      SDT,
      gc.address,
      masterchef.address,
      deployer._address,
      deployer._address,
      deployer._address
    ]);
    sdtDProxy = await Proxy.connect(deployer).deploy(sdtDistributor.address, proxyAdmin.address, dataSdtD);
    sdtDProxy = await ethers.getContractAt("SdtDistributor", sdtDProxy.address);
    /* Deployed quick and dirty */

    /* ==== Create Frax Strategy ==== */
    strategy = await FraxStrategy.deploy(
      locker.address,
      deployer._address,
      dummyMs.address,
      FXSACCUMULATOR,
      VeSdtProxy.address,
      sdtDProxy.address
    );
    await locker.connect(deployer).setGovernance(strategy.address);

    /* ==== Create Frax Vault Factory ==== */
    fraxVaultFactoryContract = await fraxVaultFactory.deploy(
      liquidityGaugeStratImp.address,
      strategy.address,
      sdtDProxy.address
    );
    await strategy.connect(deployer).setVaultGaugeFactory(fraxVaultFactoryContract.address);

    /* ==== Create Frax Vault for FXS_TEMPLE ==== */
    const cloneTx = await (await fraxVaultFactoryContract.cloneAndInit(FXS_TEMPLE_GAUGE)).wait();
    fxsTempleVault = await ethers.getContractAt("FraxVault", cloneTx.events[0].args[0]);
    // Only vault can deposit and withdraw for LiquidityGaugeV4Strat
    fxsTempleMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", cloneTx.events[1].args[0]);
    fxsTempleLiqudityGauge = await ethers.getContractAt("LiquidityGaugeV4", FXS_TEMPLE_GAUGE);

    /* ==== Add gauge types ==== */
    const typesWeight = parseEther("1");
    await gc.connect(deployer)["add_type(string,uint256)"]("Mainnet staking", typesWeight); // 0
    await gc.connect(deployer)["add_type(string,uint256)"]("External", typesWeight); // 1
    await gc.connect(deployer)["add_type(string,uint256)"]("Cross Chain", typesWeight) // 2

    // add fxsTemple gauge to gaugecontroller
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](fxsTempleMultiGauge.address, 0, 0); // gauge - type - weight

    /* ==== Masterchef <> SdtDistributor setup ==== */
    const masterToken = await sdtDProxy.masterchefToken();
    await masterchef.connect(timelock).add(1000, masterToken, false);
    const poolsLength = await masterchef.poolLength();
    const pidSdtD = poolsLength - 1;
    await sdtDProxy.connect(deployer).initializeMasterchef(pidSdtD);
    await sdtDProxy.connect(deployer).setDistribution(true);

  });
  describe("Angle Vault tests", function () {
    const LOCKDURATION = 4 * WEEK;
    const DEPOSITEDAMOUNT = parseUnits("100", 18);
    it("Liquidity Gauge token should be set properly", async function () {
      const name = await fxsTempleMultiGauge.name();
      const symbol = await fxsTempleMultiGauge.symbol();
      expect(name).to.be.equal("Stake DAO UNI-V2 Gauge");
      expect(symbol).to.be.equal("sdUNI-V2-gauge");
      // Name of FXS Temple LP token is UNI-V2 ... 
    })
    it("Should deposit FXS/Temple to vault and get gauge token", async function () {
      const lockedStakesOfLockerBeforeDeposit = await fxsTempleGaugeFrax.lockedStakesOf(locker.address);
      await fxsTemple.connect(LPHolder).approve(fxsTempleVault.address, DEPOSITEDAMOUNT);
      await fxsTempleVault.connect(LPHolder).deposit(DEPOSITEDAMOUNT, LOCKDURATION);
      const lockedStakesOfLockerAfterDeposit = await fxsTempleGaugeFrax.lockedStakesOf(locker.address);
      const kekIdLPHolder = await fxsTempleVault.getKekIdUser(LPHolder._address);
      const lockedInformationsOfDepositor = await fxsTempleVault.getLockedInformations(kekIdLPHolder[0])
      const lockedStakesOfLPHolder = await fxsTempleGaugeFrax.lockedStakes(locker.address, 0);
      const gaugeTokenBalanceOfDepositor = await fxsTempleMultiGauge.balanceOf(LPHolder._address);

      expect(lockedStakesOfLockerBeforeDeposit.length).to.be.eq(0)
      expect(lockedStakesOfLockerAfterDeposit.length).to.be.eq(1)
      expect(lockedStakesOfLPHolder["liquidity"]).to.be.eq(DEPOSITEDAMOUNT.toString())
      expect(lockedStakesOfLPHolder["kek_id"]).to.be.eq(kekIdLPHolder[0]);
      expect(gaugeTokenBalanceOfDepositor.toString()).to.be.eq(lockedInformationsOfDepositor["shares"]);
    })
    it("Should be able to withdraw deposited amount and gauge tokens should be burned", async function () {
      const lpTokenOfDepositorBeforeWithdraw = await fxsTemple.balanceOf(LPHolder._address)
      const kekIdOfDepositorBeforeWithdraw = await fxsTempleVault.getKekIdUser(LPHolder._address);
      // increase the timestamp by 1 month
      await network.provider.send("evm_increaseTime", [4 * WEEK]);
      await network.provider.send("evm_mine", []);
      await fxsTempleVault.connect(LPHolder).withdraw(kekIdOfDepositorBeforeWithdraw[0])
      const lpTokenOfDepositorAfterWithdraw = await fxsTemple.balanceOf(LPHolder._address)
      const net = lpTokenOfDepositorAfterWithdraw - lpTokenOfDepositorBeforeWithdraw;
      const gaugeTokenBalanceOfDepositor = await fxsTempleMultiGauge.balanceOf(LPHolder._address);
      const kekIdOfDepositorAfterWithdraw = await fxsTempleVault.getKekIdUser(LPHolder._address);
      const lockedInformationsOfDepositor = await fxsTempleVault.getLockedInformations(kekIdOfDepositorBeforeWithdraw[0])

      expect(net).to.be.gt(0)
      expect(gaugeTokenBalanceOfDepositor).to.be.eq(0)
      expect(kekIdOfDepositorAfterWithdraw.length).to.be.eq(0)
      expect(lockedInformationsOfDepositor["owner"]).to.be.eq(NULL)
    })
    it("Shouldn't be able to withdraw when there is no enough gauge token", async function () {
      const TOTRANSFER = parseUnits("5", 18);
      await fxsTemple.connect(LPHolder).approve(fxsTempleVault.address, DEPOSITEDAMOUNT);
      await fxsTempleVault.connect(LPHolder).deposit(DEPOSITEDAMOUNT, LOCKDURATION);
      const kekIdOfDepositorBeforeWithdraw = await fxsTempleVault.getKekIdUser(LPHolder._address);
      const deployerStakedBeforeTransfer = await fxsTempleMultiGauge.balanceOf(deployer._address);
      //const before = await fxsTempleMultiGauge.balanceOf(LPHolder._address)
      await fxsTempleMultiGauge.connect(LPHolder).transfer(deployer._address, TOTRANSFER)
      //const after = await fxsTempleMultiGauge.balanceOf(LPHolder._address)
      const deployerStakedAfterTransfer = await fxsTempleMultiGauge.balanceOf(deployer._address);
      const tx = await fxsTempleVault.connect(LPHolder).withdraw(kekIdOfDepositorBeforeWithdraw[0]).catch((e: any) => e);
      expect(tx.message).to.have.string("Not enough staked");
      expect(deployerStakedBeforeTransfer).to.be.equal(0);
      expect(deployerStakedAfterTransfer).to.be.equal(TOTRANSFER);
    })
    it("Shouldn't be able withdraw from multigauge if not vault", async function () {
      const stakedBalance = await fxsTempleMultiGauge.balanceOf(LPHolder._address);
      await expect(fxsTempleMultiGauge.connect(LPHolder)["withdraw(uint256,address)"](stakedBalance, LPHolder._address)).to.be.reverted
    })
    it("Shouldn't be able to approve vault on the strategy when not governance", async function () {
      const tx = await strategy.toggleVault(fxsTempleVault.address).catch((e: any) => e);
      expect(tx.message).to.have.string("!governance");
    })
    it("Shouldn't be able to add gauge if it's not governance", async function () {
      const tx = await strategy.setGauge(FXS_TEMPLE, FXS_TEMPLE_GAUGE).catch((e: any) => e);
      expect(tx.message).to.have.string("!governance");
    });
    it("Should be able to claim rewards when some time pass", async function () {
      await gc.connect(veSdtHolder).vote_for_gauge_weights(fxsTempleMultiGauge.address, 10000);
      await fxsTemple.connect(LPHolder).approve(fxsTempleVault.address, DEPOSITEDAMOUNT);
      await fxsTempleVault.connect(LPHolder).deposit(DEPOSITEDAMOUNT, LOCKDURATION);
      await sdtDProxy.connect(deployer).approveGauge(fxsTempleMultiGauge.address);
      // increase the timestamp by 1 month
      await network.provider.send("evm_increaseTime", [LOCKDURATION]);
      await network.provider.send("evm_mine", []);
      //await gc.connect(veSdtHolder).checkpoint_gauge(fxsTempleMultiGauge.address);

      const multiGaugeRewardRateBefore = await fxsTempleMultiGauge.reward_data(fxs.address);
      const msFxsBalanceBefore = await fxs.balanceOf(dummyMs.address)
      const accumulatorFxsBalanceBefore = await fxs.balanceOf(FXSACCUMULATOR)
      const deci = await fxsTempleLiqudityGauge.decimals()
      console.log(deci)
      //const claimable = await fxsTempleLiqudityGauge.claimable_reward(FXSLOCKER, SDT)
      //const claim = await strategy.claim(fxsTemple.address)
      const gauge = await strategy.gauges(fxsTemple.address)
      const multiGauge = await strategy.multiGauges(gauge)
      console.log(multiGauge)
      //console.log(claimable)

    })
  })
})