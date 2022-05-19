import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import ERC20ABI from "./fixtures/ERC20.json";
import WalletCheckerABI from "./fixtures/WalletChecker.json";
import VeANGLEABI from "./fixtures/veANGLE.json";
import FEEDABI from "./fixtures/FeeD.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, parseUnits } from "@ethersproject/units";
import AngleLockerABI from "./fixtures/AngleLocker.json";
import { writeBalance } from "./utils";
const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const ANGLE_HOLDER = "0x7bB909d58E54aba5596DFCaA873df0d50bC5d760";
const ANGLE_HOLDER_2 = "0x9843C8a8263308A309BfC3C2d1c308126D8E754D";

const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const VESDTBOOST = "0xD67bdBefF01Fc492f1864E61756E5FBB3f173506";
const ANGLE = "0x31429d1856aD1377A8A0079410B297e1a9e214c2";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const VE_ANGLE = "0x0C462Dbb9EC8cD1630f1728B2CFD2769d09f0dd5";
const SDFRAX3CRV = "0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7";
const SDANGLEGAUGE = "0xE55843a90672f7d8218285e51EE8fF8E233F35d5";
const WALLET_CHECKER = "0xAa241Ccd398feC742f463c534a610529dCC5888E";
const WALLET_CHECKER_OWNER = "0xdC4e6DFe07EFCa50a197DF15D9200883eF4Eb1c8";

const FEE_DISTRIBUTOR = "0x7F82ff050128e29Fd89D85d01b93246F744E62A0";
const ANGLE_GAUGE_CONTROLLER = "0x9aD7e7b0877582E14c17702EecF49018DD6f2367";
const STAKEDAO_FEE_DISTRIBUTOR = "0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92";
const GAUGE = "0x3785Ce82be62a342052b9E5431e9D3a839cfB581"; // G-UNI LP gauge

const ACC = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // StakeDAO multisig

const ANGLEACCUMULATOR = "0x943671e6c3a98e28abdbc60a7ac703b3c0c6aa51";
const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";
const SAN_USDC_EUR = "0x9C215206Da4bf108aE5aEEf9dA7caD3352A36Dad"; // sanUSDC_EUR
const SAN_DAI_EUR = "0x7b8e89b0ce7bac2cfec92a371da899ea8cbdb450"; // sanDAI_EUR

const SAN_USDC_EUR_HOLDER = "0x411ce0be9f5e595e19dc05be8551e951778b439f";
const SAN_DAI_EUR_HOLDER = "0x5edcf547ece0ea1765d6c02e9e5bae53b52e09d4";

const FEE_D_ADMIN = "0xdC4e6DFe07EFCa50a197DF15D9200883eF4Eb1c8";
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";
const sanUSDC_EUR_GAUGE = "0x51fE22abAF4a26631b2913E417c0560D547797a7";
const sanDAI_EUR_GAUGE = "0x8E2c0CbDa6bA7B65dbcA333798A3949B07638026";
const VESDT_HOLDER = "0xdceb0bb3311342e3ce9e49f57affce9deac40ba1";
const ANGLE_DISTRIBUTOR = "0x4f91F01cE8ec07c9B1f6a82c18811848254917Ab";
const GUNI_AGEUR_WETH_LP = "0x857E0B2eD0E82D5cDEB015E77ebB873C47F99575";
const GUNI_AGEUR_WETH_ANGLE_GAUGE = "0x3785Ce82be62a342052b9E5431e9D3a839cfB581";

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("ANGLE Strategy", function () {
  let locker: Contract;
  let angle: Contract;
  let sanUsdcEur: Contract;
  let sanDaiEur: Contract;
  let sdt: Contract;

  let deployer: JsonRpcSigner;
  let dummyMs: SignerWithAddress;
  let VeSdtProxy: Contract;
  let sanLPHolder: JsonRpcSigner;
  let sanDAILPHolder: JsonRpcSigner;
  let localDeployer: SignerWithAddress;

  let strategy: Contract;
  let sanUSDCEurVault: Contract;
  let sanUSDCEurMultiGauge: Contract;
  let sanUsdcEurLiqudityGauge: Contract;
  let angleVaultFactoryContract: Contract;
  let frax: Contract;
  let sdFrax3Crv: Contract;
  let sdAngleGauge: Contract;
  let angleAccumulator: Contract;
  let sanDaiEurVault: Contract;
  let sanDaiEurMultiGauge: Contract;
  let sanDaiEurLiqudityGauge: Contract;
  let masterchef: Contract;
  let sdtDistributor: Contract;
  let gc: Contract;
  let sdtDProxy: Contract;
  let timelock: JsonRpcSigner;
  let veSdtHolder: JsonRpcSigner;
  let angleDistributor: JsonRpcSigner;
  let angleGUniVault: Contract;
  let angleGuniGauge: Contract;
  let gUniAgeurEth: Contract;
  let gUniAgeurEthAngleGauge: Contract;
  before(async function () {
    [localDeployer, dummyMs] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SAN_USDC_EUR_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SAN_DAI_EUR_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [TIMELOCK]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [VESDT_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ANGLE_DISTRIBUTOR]
    });
    const AngleStrategy = await ethers.getContractFactory("AngleStrategy");
    const SdtDistributor = await ethers.getContractFactory("SdtDistributorV2");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    deployer = ethers.provider.getSigner(STDDEPLOYER);
    sanLPHolder = ethers.provider.getSigner(SAN_USDC_EUR_HOLDER);
    sanDAILPHolder = ethers.provider.getSigner(SAN_DAI_EUR_HOLDER);
    timelock = await ethers.provider.getSigner(TIMELOCK);
    veSdtHolder = await ethers.provider.getSigner(VESDT_HOLDER);
    angleDistributor = await ethers.provider.getSigner(ANGLE_DISTRIBUTOR);
    await network.provider.send("hardhat_setBalance", [SAN_USDC_EUR_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [SAN_DAI_EUR_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [VESDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [ANGLE_DISTRIBUTOR, ETH_100]);
    await network.provider.send("hardhat_setBalance", [timelock._address, parseEther("10").toHexString()]);
    await writeBalance(SAN_USDC_EUR, "50000000000", SAN_USDC_EUR_HOLDER);
    await writeBalance(SAN_DAI_EUR, "50000000000", SAN_DAI_EUR_HOLDER);
    await writeBalance(GUNI_AGEUR_WETH_LP, "50000000000", localDeployer.address);
    locker = await ethers.getContractAt(AngleLockerABI, "0xd13f8c25cced32cdfa79eb5ed654ce3e484dcaf5");
    sanUsdcEur = await ethers.getContractAt(ERC20ABI, SAN_USDC_EUR);
    sanDaiEur = await ethers.getContractAt(ERC20ABI, SAN_DAI_EUR);
    angle = await ethers.getContractAt(ERC20ABI, ANGLE);
    frax = await ethers.getContractAt(ERC20ABI, FRAX);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    gUniAgeurEth = await ethers.getContractAt(ERC20ABI, GUNI_AGEUR_WETH_LP);
    sdFrax3Crv = await ethers.getContractAt(ERC20ABI, SDFRAX3CRV);
    sdAngleGauge = await ethers.getContractAt("LiquidityGaugeV4", SDANGLEGAUGE);
    gUniAgeurEthAngleGauge = await ethers.getContractAt("LiquidityGaugeV4", GUNI_AGEUR_WETH_ANGLE_GAUGE);
    angleAccumulator = await ethers.getContractAt("AngleAccumulatorV2", ANGLEACCUMULATOR);
    const veSdtAngleProxyFactory = await ethers.getContractFactory("veSDTFeeAngleProxy");
    VeSdtProxy = await veSdtAngleProxyFactory.deploy([ANGLE, WETH, FRAX]);

    const proxyAdmin = await ProxyAdmin.deploy();
    masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);

    let ABI_SDTD = [
      "function initialize(address _controller, address governor, address guardian, address _delegate_gauge)"
    ];
    let iface = new ethers.utils.Interface(ABI_SDTD);
    // Contracts upgradeable
    sdtDistributor = await SdtDistributor.deploy();
    gc = await GaugeController.connect(deployer).deploy(SDT, VE_SDT, deployer._address);
    const dataSdtD = iface.encodeFunctionData("initialize", [
      gc.address,
      deployer._address,
      deployer._address,
      deployer._address
    ]);

    sdtDProxy = await Proxy.connect(deployer).deploy(sdtDistributor.address, proxyAdmin.address, dataSdtD);
    sdtDProxy = await ethers.getContractAt("SdtDistributorV2", sdtDProxy.address);
    strategy = await AngleStrategy.deploy(
      locker.address,
      deployer._address,
      dummyMs.address,
      ANGLEACCUMULATOR,
      VeSdtProxy.address,
      sdtDProxy.address
    );
    await locker.connect(deployer).setGovernance(strategy.address);
    // await sanUsdcEur.connect(sanLPHolder).transfer(locker.address, parseUnits("10000", "6"));
    // await sanUsdcEur.connect(sanLPHolder).transfer(strategy.address, parseUnits("10000", "6"));
    await sanUsdcEur.connect(sanLPHolder).transfer(deployer._address, parseUnits("10000", "6"));

    // await sanDaiEur.connect(sanDAILPHolder).transfer(locker.address, parseUnits("10000", "18"));
    // await sanDaiEur.connect(sanDAILPHolder).transfer(strategy.address, parseUnits("10000", "18"));
    await sanDaiEur.connect(sanDAILPHolder).transfer(deployer._address, parseUnits("10000", "18"));
    const liquidityGaugeFactory = await ethers.getContractFactory("LiquidityGaugeV4Strat");
    const liquidityGaugeStratImp = await liquidityGaugeFactory.deploy();
    const angleVaultFactory = await ethers.getContractFactory("AngleVaultFactory");

    angleVaultFactoryContract = await angleVaultFactory.deploy(
      liquidityGaugeStratImp.address,
      strategy.address,
      sdtDProxy.address
    );
    await strategy.connect(deployer).setVaultGaugeFactory(angleVaultFactoryContract.address);
    const cloneTx = await (await angleVaultFactoryContract.cloneAndInit(sanUSDC_EUR_GAUGE)).wait();
    const gauge = cloneTx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];

    sanUSDCEurVault = await ethers.getContractAt("AngleVault", cloneTx.events[0].args[0]);
    sanUSDCEurMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge);

    sanUsdcEurLiqudityGauge = await ethers.getContractAt("LiquidityGaugeV4", sanUSDC_EUR_GAUGE);
    sanDaiEurLiqudityGauge = await ethers.getContractAt("LiquidityGaugeV4", sanDAI_EUR_GAUGE);
    // Add gauge types
    const typesWeight = parseEther("1");
    await gc.connect(deployer)["add_type(string,uint256)"]("Mainnet staking", typesWeight); // 0
    await gc.connect(deployer)["add_type(string,uint256)"]("External", typesWeight); // 1
    await gc.connect(deployer)["add_type(string,uint256)"]("Cross Chain", typesWeight); // 2

    // add sanusdcEur gauge to gaugecontroller
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](sanUSDCEurMultiGauge.address, 0, 0); // gauge - type - weight

    /** Masterchef <> SdtDistributor setup */
    const masterToken = await sdtDProxy.masterchefToken();
    await masterchef.connect(timelock).add(1000, masterToken, false);
    const poolsLength = await masterchef.poolLength();
    const pidSdtD = poolsLength - 1;
    await sdtDProxy.connect(deployer).initializeMasterchef(pidSdtD);
    await sdtDProxy.connect(deployer).setDistribution(true);

    const angleGUniVaultFactory = await ethers.getContractFactory("AngleVaultGUni");

    angleGUniVault = await angleGUniVaultFactory.deploy(
      GUNI_AGEUR_WETH_LP,
      deployer._address,
      "Stake DAO GUniAgeur/ETH Vault",
      "sdGUniAgeur/ETH-vault",
      strategy.address,
      "966923637982619002"
    );

    const ABI = [
      "function initialize(address _staking_token,address _admin,address _SDT,address _voting_escrow,address _veBoost_proxy,address _distributor,address _vault,string memory _symbol)"
    ];

    const ifaceTwo = new ethers.utils.Interface(ABI);
    const liquidityGaugeImp = await liquidityGaugeFactory.deploy();
    const data = ifaceTwo.encodeFunctionData("initialize", [
      angleGUniVault.address,
      deployer._address,
      SDT,
      VE_SDT,
      VESDTBOOST,
      strategy.address,
      angleGUniVault.address,
      "agEur/ETH"
    ]);

    angleGuniGauge = await Proxy.connect(deployer).deploy(liquidityGaugeImp.address, proxyAdmin.address, data);
    angleGuniGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", angleGuniGauge.address);
    await angleGUniVault.connect(deployer).setLiquidityGauge(angleGuniGauge.address);
    await strategy.connect(deployer).toggleVault(angleGUniVault.address);
    await strategy.connect(deployer).setGauge(GUNI_AGEUR_WETH_LP, GUNI_AGEUR_WETH_ANGLE_GAUGE);
    await strategy.connect(deployer).setMultiGauge(GUNI_AGEUR_WETH_ANGLE_GAUGE, angleGuniGauge.address);
  });

  describe("Angle Vault tests", function () {
    it("Liquidity Gauge token should set properly", async function () {
      const name = await sanUSDCEurMultiGauge.name();
      const symbol = await sanUSDCEurMultiGauge.symbol();
      expect(name).to.be.equal("Stake DAO sanUSDC_EUR Gauge");
      expect(symbol).to.be.equal("sdsanUSDC_EUR-gauge");
    });

    it("Should deposit sanUSDC-EUR to vault and get gauge tokens", async function () {
      const vaultSanUsdcEurBalanceBeforeDeposit = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      await sanUsdcEur.connect(sanLPHolder).approve(sanUSDCEurVault.address, parseUnits("1000", 6));
      await sanUSDCEurVault.connect(sanLPHolder).deposit(sanLPHolder._address, parseUnits("1000", 6), false);
      const vaultSanUsdcEurBalanceAfterDeposit = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      const gaugeTokenBalanceOfDepositor = await sanUSDCEurMultiGauge.balanceOf(sanLPHolder._address);
      expect(vaultSanUsdcEurBalanceBeforeDeposit).to.be.eq(0);
      expect(vaultSanUsdcEurBalanceAfterDeposit).to.be.equal(parseUnits("1000", 6).toString());
      expect(gaugeTokenBalanceOfDepositor).to.be.equal(parseUnits("999", 6).toString());
    });
    it("Should be able to withdraw deposited amount and gauge tokens should be burned", async function () {
      const vaultSanUsdcEurBalanceBeforeWithdraw = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      await sanUSDCEurVault.connect(sanLPHolder).withdraw(parseUnits("999", 6));
      const vaultSanUsdcEurBalanceAfterWithdraw = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      const gaugeTokenBalanceOfDepositor = await sanUSDCEurMultiGauge.balanceOf(sanLPHolder._address);
      expect(vaultSanUsdcEurBalanceBeforeWithdraw).to.be.gt(0);
      expect(vaultSanUsdcEurBalanceAfterWithdraw).to.be.eq(parseUnits("1", 6));
      expect(gaugeTokenBalanceOfDepositor).to.be.eq(0);
    });
    it("Shouldn't be able to withdraw when there is no enough gauge token", async function () {
      await sanUsdcEur.connect(sanLPHolder).approve(sanUSDCEurVault.address, parseUnits("1000", 6));
      await sanUSDCEurVault.connect(sanLPHolder).deposit(sanLPHolder._address, parseUnits("1000", 6), false);
      const deployerStaked = await sanUSDCEurMultiGauge.balanceOf(deployer._address);
      await sanUSDCEurMultiGauge.connect(sanLPHolder).transfer(deployer._address, parseUnits("499", 6));
      const deployerStakedAfterTransfer = await sanUSDCEurMultiGauge.balanceOf(deployer._address);
      const tx = await sanUSDCEurVault
        .connect(sanLPHolder)
        .withdraw(parseUnits("999", 6))
        .catch((e: any) => e);
      expect(tx.message).to.have.string("Not enough staked");
      expect(deployerStaked).to.be.equal(0);
      expect(deployerStakedAfterTransfer).to.be.equal(parseUnits("499", 6));
    });
    it("it should not be able withdraw from multigauge if not vault", async () => {
      const stakedBalance = await sanUSDCEurMultiGauge.balanceOf(sanLPHolder._address);
      await expect(
        sanUSDCEurMultiGauge.connect(sanLPHolder)["withdraw(uint256,address)"](stakedBalance, sanLPHolder._address)
      ).to.be.reverted;
    });
    it("Should not be able to approve vault on the strategy when not governance", async function () {
      const tx = await strategy.toggleVault(sanUSDCEurVault.address).catch((e: any) => e);
      expect(tx.message).to.have.string("!governance");
    });
    it("should not be able to add gauge if it's not governance", async function () {
      const tx = await strategy.setGauge(SAN_USDC_EUR, sanUSDC_EUR_GAUGE).catch((e: any) => e);
      expect(tx.message).to.have.string("!governance");
    });
    it("Should be able to call earn therefore get accumulated fees as staked amount and stake the amounts to the Angle gauge", async function () {
      const sanUsdcEurAngleGaugeStakedBefore = await sanUsdcEurLiqudityGauge.balanceOf(locker.address);
      const accumulatedFees = await sanUSDCEurVault.accumulatedFee();
      const tx = await (await sanUSDCEurVault.deposit(localDeployer.address, 0, true)).wait();
      const deployerStakedAmount = await sanUSDCEurMultiGauge.balanceOf(localDeployer.address);
      const vaultSanUsdcEurBalanceAfterEarn = await sanUsdcEur.balanceOf(sanUSDCEurVault.address);
      const sanUsdcEurAngleGaugeStakedAfter = await sanUsdcEurLiqudityGauge.balanceOf(locker.address);
      expect(sanUsdcEurAngleGaugeStakedBefore).to.be.eq(0);
      expect(sanUsdcEurAngleGaugeStakedAfter).to.be.eq(parseUnits("1001", 6));
      expect(vaultSanUsdcEurBalanceAfterEarn).to.be.equal(0);
      expect(deployerStakedAmount).to.be.eq(accumulatedFees);
    });
    // it("Should pay withdraw fee if withdraw from Angle gauge", async function () {
    //   const sanUsdcEurBalanceBeforeWithdraw = await sanUsdcEur.balanceOf(sanLPHolder._address);
    //   const tx = await (await sanUSDCEurVault.connect(sanLPHolder).withdraw(parseUnits("500", 6))).wait();
    //   const sanUsdcEurBalanceAfterWithdraw = await sanUsdcEur.balanceOf(sanLPHolder._address);
    //   const sanUsdcEurAngleGaugeStakedAfterWithdraw = await sanUsdcEurLiqudityGauge.balanceOf(locker.address);
    //   const fee = parseUnits("500", 6).mul(50).div(10000);
    //   expect(sanUsdcEurBalanceAfterWithdraw.sub(sanUsdcEurBalanceBeforeWithdraw)).to.be.equal(
    //     parseUnits("500", 6).sub(fee)
    //   );
    //   expect(sanUsdcEurAngleGaugeStakedAfterWithdraw).to.be.equal(parseUnits("501", 6));
    // });

    it("should be able to claim rewards when some time pass", async () => {
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanUSDCEurMultiGauge.address, 10000);
      await sanUsdcEur.connect(sanLPHolder).approve(sanUSDCEurVault.address, parseUnits("100000", 6));
      await sanUSDCEurVault.connect(sanLPHolder).deposit(sanLPHolder._address, parseUnits("100000", 6), true);
      await sdtDProxy.connect(deployer).approveGauge(sanUSDCEurMultiGauge.address);
      // increase the timestamp by 1 month
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 30]);
      await network.provider.send("evm_mine", []);
      // await gc.connect(veSdtHolder).checkpoint_gauge(sanUSDCEurMultiGauge.address);

      const multiGaugeRewardRateBefore = await sanUSDCEurMultiGauge.reward_data(angle.address);
      const msAngleBalanceBefore = await angle.balanceOf(dummyMs.address);
      const accumulatorAngleBalanceBefore = await angle.balanceOf(ANGLEACCUMULATOR);
      const claimable = await sanUsdcEurLiqudityGauge.claimable_reward(locker.address, angle.address);
      const tx = await (await strategy.claim(sanUsdcEur.address)).wait();
      const angleGRWA = await gc["gauge_relative_weight(address)"](sanUSDCEurMultiGauge.address);
      const accumulatorAngleBalanceAfter = await angle.balanceOf(ANGLEACCUMULATOR);
      const multiGaugeRewardRateAfter = await sanUSDCEurMultiGauge.reward_data(angle.address);
      const sdtRewardsAfter = await sanUSDCEurMultiGauge.reward_data(SDT);
      const msAngleBalanceAfter = await angle.balanceOf(dummyMs.address);
      const perfFee = claimable.mul(BigNumber.from(200)).div(BigNumber.from(10000));
      const accumulatorPart = claimable.mul(BigNumber.from(800)).div(BigNumber.from(10000));
      const claimed = tx.events.find((e: any) => e.event === "Claimed");
      const sdtBalance = await sdt.balanceOf(sanUSDCEurMultiGauge.address);
      const sdtBalanceOfDistributor = await sdt.balanceOf(sdtDProxy.address);
      expect(claimed.args[2]).to.be.equal(claimable);
      expect(multiGaugeRewardRateBefore[3]).to.be.equal(0);
      expect(multiGaugeRewardRateAfter[3]).to.be.gt(0);
      expect(sdtRewardsAfter[3]).to.be.gt(0);
      expect(perfFee).to.be.gt(0);
      expect(accumulatorPart).to.be.gt(0);
      expect(msAngleBalanceAfter.sub(msAngleBalanceBefore)).to.be.equal(perfFee);
      expect(accumulatorAngleBalanceAfter.sub(accumulatorAngleBalanceBefore)).to.be.equal(accumulatorPart);
      expect(angleGRWA).to.be.eq(parseEther("1")); // 100%
    });
    it("it should get maximum boost from angle liquidity gauge", async () => {
      const workingBalance = await sanUsdcEurLiqudityGauge.working_balances(locker.address);
      const stakedAmount = await sanUsdcEurLiqudityGauge.balanceOf(locker.address);
      const boost = workingBalance.mul(BigNumber.from(10).pow(18)).div(stakedAmount.mul(4).div(10));
      expect(boost).to.be.eq(parseEther("2.5"));
    });
    it("it should be able swap angles and transfer to feeDistributor from veSDTFeeAngleProxy", async () => {
      const fraxBalanceOfClaimer = await frax.balanceOf(localDeployer.address);
      const sd3CrvBalanceOfFeeD = await sdFrax3Crv.balanceOf(STAKEDAO_FEE_DISTRIBUTOR);
      await VeSdtProxy.sendRewards();
      const fraxBalanceOfClaimerAfterClaim = await frax.balanceOf(localDeployer.address);
      const sd3CrvBalanceOfFeeDAfterRewards = await sdFrax3Crv.balanceOf(STAKEDAO_FEE_DISTRIBUTOR);
      expect(fraxBalanceOfClaimerAfterClaim.sub(fraxBalanceOfClaimer)).to.be.gt(0);
      expect(sd3CrvBalanceOfFeeDAfterRewards.sub(sd3CrvBalanceOfFeeD)).to.be.gt(0);
    });
    it("it should accumulated angle rewards to sdAngle liquidity gauge from AngleAccumulator", async () => {
      const gaugeAngleBalanceBefore = await angle.balanceOf(sdAngleGauge.address);
      await sdAngleGauge.connect(deployer).add_reward(angle.address, angleAccumulator.address);
      await angleAccumulator.connect(deployer).notifyAllExtraReward(angle.address);
      const gaugeAngleBalanceAfter = await angle.balanceOf(sdAngleGauge.address);
      const angleAccumulatorBalance = await angle.balanceOf(angleAccumulator.address);
      expect(gaugeAngleBalanceAfter.sub(gaugeAngleBalanceBefore)).to.be.gt(0);
      expect(angleAccumulatorBalance).to.be.equal(0);
    });
    it("it should create new vault and multigauge rewards for different Angle LP token", async () => {
      const cloneTx = await (await angleVaultFactoryContract.cloneAndInit(sanDAI_EUR_GAUGE)).wait();
      sanDaiEurVault = await ethers.getContractAt("AngleVault", cloneTx.events[0].args[0]);

      const gauge = cloneTx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];

      sanDaiEurMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge);
      const tokenOfVault = await sanDaiEurVault.token();
      // add sanDaiEur gauge to gaugecontroller
      await gc.connect(deployer)["add_gauge(address,int128,uint256)"](sanDaiEurMultiGauge.address, 0, 0); // gauge - type - weight
      await sdtDProxy.connect(deployer).approveGauge(sanDaiEurMultiGauge.address);
      expect(tokenOfVault.toLowerCase()).to.be.equal(SAN_DAI_EUR.toLowerCase());
    });
    it("it should be able to deposit sanDAIEur to new vault", async () => {
      const gaugeTokenBalanceBeforeDeposit = await sanDaiEurMultiGauge.balanceOf(sanDAILPHolder._address);
      await sanDaiEur.connect(sanDAILPHolder).approve(sanDaiEurVault.address, ethers.constants.MaxUint256);
      await sanDaiEurVault.connect(sanDAILPHolder).deposit(sanDAILPHolder._address, parseEther("10000"), false);
      const gaugeTokenBalanceAfterDeposit = await sanDaiEurMultiGauge.balanceOf(sanDAILPHolder._address);
      expect(gaugeTokenBalanceBeforeDeposit).to.be.equal(0);
      expect(gaugeTokenBalanceAfterDeposit.sub(gaugeTokenBalanceBeforeDeposit)).to.be.equal(parseEther("9990"));
    });
    it("it should send tokens to angle gauge after call earn for new vault", async () => {
      const sanDaiEurAngleGaugeStakedBefore = await sanDaiEurLiqudityGauge.balanceOf(locker.address);
      await (await sanDaiEurVault.deposit(localDeployer.address, 0, true)).wait();
      const sanUsdcEurAngleGaugeStakedAfter = await sanDaiEurLiqudityGauge.balanceOf(locker.address);
      expect(sanDaiEurAngleGaugeStakedBefore).to.be.equal(0);
      expect(sanUsdcEurAngleGaugeStakedAfter).to.be.equal(parseEther("10000"));
    });
    // it("it should transfer governance of locker by execute function through angleStrategy", async () => {
    //   let setGovernanceFunction = ["function setGovernance(address _governance)"];
    //   let iSetGovernance = new ethers.utils.Interface(setGovernanceFunction);
    //   const data = iSetGovernance.encodeFunctionData("setGovernance", [dummyMs.address]);
    //   await strategy.connect(deployer).execute(locker.address, 0, data);
    //   const newGovernance = await locker.governance();
    //   expect(newGovernance).to.be.equal(dummyMs.address);
    // });
    it("It should distribute for one gauge for during 44 days then it should distribute other gauge rewards at once for 44days ", async () => {
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanUSDCEurMultiGauge.address, 5000);
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanDaiEurMultiGauge.address, 5000);
      // increase the timestamp by 1 week
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]);
      await network.provider.send("evm_mine", []);
      await sanDaiEurLiqudityGauge
        .connect(angleDistributor)
        .deposit_reward_token(ANGLE, ethers.utils.parseEther("10000"));
      await strategy.claim(sanDaiEur.address);

      for (let i = 0; i < 44; i++) {
        await network.provider.send("evm_increaseTime", [60 * 60 * 24]);
        await network.provider.send("evm_mine", []);
        await strategy.claim(sanDaiEur.address);
        if (i % 7 == 0) {
          await sanDaiEurLiqudityGauge
            .connect(angleDistributor)
            .deposit_reward_token(ANGLE, ethers.utils.parseEther("10000"));
          await sanUsdcEurLiqudityGauge
            .connect(angleDistributor)
            .deposit_reward_token(ANGLE, ethers.utils.parseEther("10000"));
        }
      }
      await strategy.claim(sanUsdcEur.address);
      const sdtBalanceOfDistributor = await sdt.balanceOf(sdtDProxy.address);
      expect(sdtBalanceOfDistributor).to.be.equal(0);
    });
    it("it should stake guni token to angle gauge and should be scaled down", async () => {
      const beforeStaked = await gUniAgeurEthAngleGauge.balanceOf(locker.address);
      await gUniAgeurEth.approve(angleGUniVault.address, ethers.constants.MaxUint256);
      await angleGUniVault.deposit(localDeployer.address, ethers.utils.parseEther("10"), true);
      const afterStaked = await gUniAgeurEthAngleGauge.balanceOf(locker.address);
      const scalingFactor = await angleGUniVault.scalingFactor();
      const scaledDown = ethers.utils.parseEther("10").mul(scalingFactor).div(BigNumber.from(10).pow(18));
      expect(beforeStaked).to.be.equal(0);
      expect(afterStaked).to.be.eq(scaledDown);
    });
    it("it should be able to withdraw whole amount without any leftover token", async () => {
      const balanceBefore = await angleGuniGauge.balanceOf(localDeployer.address);
      await angleGUniVault.withdraw(balanceBefore);
      const balanceAfter = await angleGuniGauge.balanceOf(localDeployer.address);
      expect(balanceBefore).to.be.gt(0);
      expect(balanceAfter).to.be.eq(0);
    });
    it("it should withdraw partially from vault partially from strat properly", async () => {
      await angleGUniVault.deposit(localDeployer.address, ethers.utils.parseEther("20"), true);
      await angleGUniVault.deposit(localDeployer.address, ethers.utils.parseEther("20"), false);
      const beforeWithdrawStakedOnAngleGauge = await gUniAgeurEthAngleGauge.balanceOf(locker.address);
      const balanceBefore = await angleGuniGauge.balanceOf(localDeployer.address);
      await angleGUniVault.withdraw(balanceBefore);
      const balanceAfter = await angleGuniGauge.balanceOf(localDeployer.address);
      const afterWithdrawStakedOnAngleGauge = await gUniAgeurEthAngleGauge.balanceOf(locker.address);
      const scalingFactor = await angleGUniVault.scalingFactor();
      const scaledDown = ethers.utils.parseEther("20").mul(scalingFactor).div(BigNumber.from(10).pow(18));
      expect(balanceBefore).to.be.gt(0);
      expect(balanceAfter).to.be.eq(0);
      expect(afterWithdrawStakedOnAngleGauge).to.be.eq(0);
      expect(beforeWithdrawStakedOnAngleGauge).to.be.equal(scaledDown);
    });
  });
});
