import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import ERC20ABI from "./fixtures/ERC20.json";
import WalletCheckerABI from "./fixtures/WalletChecker.json";
import VeCRVBI from "./fixtures/veCRV.json";
import FEEDABI from "./fixtures/FeeD.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, parseUnits } from "@ethersproject/units";
import CrvLockerABI from "./fixtures/crvLocker.json";
const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

//const CRV_HOLDER = "0x7bB909d58E54aba5596DFCaA873df0d50bC5d760";
//const CRV_HOLDER_2 = "0x9843C8a8263308A309BfC3C2d1c308126D8E754D";

const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
//const VESDTBOOST = "0xD67bdBefF01Fc492f1864E61756E5FBB3f173506";
//const CRV = "";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
//const VE_CRV = "";
//const SDFRAX3CRV = "0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7";
const SDCRVGAUGE = "0x7f50786A0b15723D741727882ee99a0BF34e3466";
//const WALLET_CHECKER = "0xAa241Ccd398feC742f463c534a610529dCC5888E";
//const WALLET_CHECKER_OWNER = "0xdC4e6DFe07EFCa50a197DF15D9200883eF4Eb1c8";

//const FEE_DISTRIBUTOR = "0x7F82ff050128e29Fd89D85d01b93246F744E62A0";
//const ANGLE_GAUGE_CONTROLLER = "0x9aD7e7b0877582E14c17702EecF49018DD6f2367";
const STAKEDAO_FEE_DISTRIBUTOR = "0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92";
//const GAUGE = "0x3785Ce82be62a342052b9E5431e9D3a839cfB581"; // G-UNI LP gauge

//const ACC = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // StakeDAO multisig

const CRV_ACCUMULATOR = "0x54C7757199c4A04BCcD1472Ad396f768D8173757";
const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";
const CRV3 = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
const CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52";
//const SAN_DAI_EUR = "0x7b8e89b0ce7bac2cfec92a371da899ea8cbdb450"; // sanDAI_EUR

const CRV3_HOLDER = "0x701aEcF92edCc1DaA86c5E7EdDbAD5c311aD720C";
//const SAN_DAI_EUR_HOLDER = "0x5edcf547ece0ea1765d6c02e9e5bae53b52e09d4";

//const FEE_D_ADMIN = "0xdC4e6DFe07EFCa50a197DF15D9200883eF4Eb1c8";
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";
const CRV3_GAUGE = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A";
//const sanDAI_EUR_GAUGE = "0x8E2c0CbDa6bA7B65dbcA333798A3949B07638026";
const VESDT_HOLDER = "0xdceb0bb3311342e3ce9e49f57affce9deac40ba1";
const CRV_LOCKER = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";
const GC_STRATEGY = "0x3F3F0776D411eb97Cfa4E3eb25F33c01ca4e7Ca8";
const SDT_D_STRATEGY = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
const DEPLOYER_NEW = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("CURVE Strategy", function () {
  let locker: Contract;
  let crv: Contract;
  let crv3: Contract;
  //let sanDaiEur: Contract;
  let sdt: Contract;

  let deployer: JsonRpcSigner;
  let deployer_new: JsonRpcSigner;
  let dummyMs: SignerWithAddress;
  let VeSdtProxy: Contract;
  let crv3Holder: JsonRpcSigner;
  //let sanDAILPHolder: JsonRpcSigner;
  let localDeployer: SignerWithAddress;

  let strategy: Contract;
  let crv3Vault: Contract;
  let crv3MultiGauge: Contract;
  let crv3LiqudityGauge: Contract;
  let curveVaultFactoryContract: Contract;
  let frax: Contract;
  let sdFrax3Crv: Contract;
  let sdCrvGauge: Contract;
  let crvAccumulator: Contract;
  //let sanDaiEurVault: Contract;
  //let sanDaiEurMultiGauge: Contract;
  //let sanDaiEurLiqudityGauge: Contract;
  let masterchef: Contract;
  let sdtDistributor: Contract;
  let gc: Contract;
  let sdtDProxy: Contract;
  let timelock: JsonRpcSigner;
  let veSdtHolder: JsonRpcSigner;
  let crvDistributor: JsonRpcSigner;
  before(async function () {
    [localDeployer, dummyMs] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });

    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [DEPLOYER_NEW]
      });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [CRV3_HOLDER]
    });
    // await network.provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: [SAN_DAI_EUR_HOLDER]
    // });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [TIMELOCK]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [VESDT_HOLDER]
    });
    // await network.provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: [CRV_LOCKER]
    // });
    const CurveStrategy = await ethers.getContractFactory("CurveStrategy");
    //const SdtDistributor = await ethers.getContractFactory("SdtDistributorV2");
    //const GaugeController = await ethers.getContractFactory("GaugeController");
    //const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    deployer = ethers.provider.getSigner(STDDEPLOYER);
    deployer_new = ethers.provider.getSigner(DEPLOYER_NEW);
    crv3Holder = ethers.provider.getSigner(CRV3_HOLDER);
    //sanDAILPHolder = ethers.provider.getSigner(SAN_DAI_EUR_HOLDER);
    timelock = await ethers.provider.getSigner(TIMELOCK);
    veSdtHolder = await ethers.provider.getSigner(VESDT_HOLDER);
    //angleDistributor = await ethers.provider.getSigner(ANGLE_DISTRIBUTOR);
    await network.provider.send("hardhat_setBalance", [CRV3_HOLDER, ETH_100]);
    //await network.provider.send("hardhat_setBalance", [SAN_DAI_EUR_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [VESDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [DEPLOYER_NEW, ETH_100]);
    await network.provider.send("hardhat_setBalance", [STDDEPLOYER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [timelock._address, parseEther("10").toHexString()]);

    locker = await ethers.getContractAt(CrvLockerABI, CRV_LOCKER);
    crv3 = await ethers.getContractAt(ERC20ABI, CRV3);
    //sanDaiEur = await ethers.getContractAt(ERC20ABI, SAN_DAI_EUR);
    crv = await ethers.getContractAt(ERC20ABI, CRV);
    frax = await ethers.getContractAt(ERC20ABI, FRAX);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    //sdFrax3Crv = await ethers.getContractAt(ERC20ABI, SDFRAX3CRV);
    sdCrvGauge = await ethers.getContractAt("LiquidityGaugeV4", SDCRVGAUGE);
    crvAccumulator = await ethers.getContractAt("CurveAccumulator", CRV_ACCUMULATOR);
    const veSdtAngleProxyFactory = await ethers.getContractFactory("veSDTFeeAngleProxy");
    gc = await ethers.getContractAt("GaugeController", GC_STRATEGY)
    VeSdtProxy = await veSdtAngleProxyFactory.deploy([CRV, WETH, FRAX]);

    const proxyAdmin = await ProxyAdmin.deploy();
    masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);

    // let ABI_SDTD = [
    //   "function initialize(address _controller, address governor, address guardian, address _delegate_gauge)"
    // ];
    // let iface = new ethers.utils.Interface(ABI_SDTD);
    // // Contracts upgradeable
    // sdtDistributor = await SdtDistributor.deploy();
    // //gc = await GaugeController.connect(deployer).deploy(SDT, VE_SDT, deployer._address);
    // const dataSdtD = iface.encodeFunctionData("initialize", [
    //   gc.address,
    //   deployer._address,
    //   deployer._address,
    //   deployer._address
    // ]);

    //sdtDProxy = await Proxy.connect(deployer).deploy(sdtDistributor.address, proxyAdmin.address, dataSdtD);
    sdtDProxy = await ethers.getContractAt("SdtDistributorV2", SDT_D_STRATEGY);
    strategy = await CurveStrategy.deploy(
      locker.address,
      deployer._address,
      dummyMs.address,
      CRV_ACCUMULATOR,
      VeSdtProxy.address,
      sdtDProxy.address
    );

    // change crvLocker strategy address to the crvAccumulator
    await network.provider.send("hardhat_setStorageAt", [
        locker.address,
        "0x1",
        "0x000000000000000000000000" + strategy.address.substring(2),
      ]);

    //await locker.connect(deployer).setStrategy(strategy.address);
    //await sanUsdcEur.connect(sanLPHolder).transfer(locker.address, parseUnits("10000", "6"));
    //await sanUsdcEur.connect(sanLPHolder).transfer(strategy.address, parseUnits("10000", "6"));
    //await sanUsdcEur.connect(sanLPHolder).transfer(deployer._address, parseUnits("10000", "6"));

    // // await sanDaiEur.connect(sanDAILPHolder).transfer(locker.address, parseUnits("10000", "18"));
    // // await sanDaiEur.connect(sanDAILPHolder).transfer(strategy.address, parseUnits("10000", "18"));
    //await sanDaiEur.connect(sanDAILPHolder).transfer(deployer._address, parseUnits("10000", "18"));
    const liquidityGaugeFactory = await ethers.getContractFactory("LiquidityGaugeV4Strat");
    const liquidityGaugeStratImp = await liquidityGaugeFactory.deploy();
    const curveVaultFactory = await ethers.getContractFactory("CurveVaultFactory");

    curveVaultFactoryContract = await curveVaultFactory.deploy(
      liquidityGaugeStratImp.address,
      strategy.address,
      sdtDProxy.address
    );
    await strategy.connect(deployer).setVaultGaugeFactory(curveVaultFactoryContract.address);
    const cloneTx = await (await curveVaultFactoryContract.cloneAndInit(CRV3_GAUGE)).wait();
    const gauge = cloneTx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];

    crv3Vault = await ethers.getContractAt("CurveVault", cloneTx.events[0].args[0]);
    crv3MultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge);

    crv3LiqudityGauge = await ethers.getContractAt("LiquidityGaugeV4", CRV3_GAUGE);
    // sanDaiEurLiqudityGauge = await ethers.getContractAt("LiquidityGaugeV4", sanDAI_EUR_GAUGE);
    // Add gauge types
    const typesWeight = parseEther("1");
    await gc.connect(deployer_new)["add_type(string,uint256)"]("Mainnet staking", typesWeight); // 0
    await gc.connect(deployer_new)["add_type(string,uint256)"]("External", typesWeight); // 1
    await gc.connect(deployer_new)["add_type(string,uint256)"]("Cross Chain", typesWeight); // 2

    // add 3crv gauge to gaugecontroller
    await gc.connect(deployer_new)["add_gauge(address,int128,uint256)"](crv3MultiGauge.address, 0, 0); // gauge - type - weight

    /** Masterchef <> SdtDistributor setup */
    const masterToken = await sdtDProxy.masterchefToken();
    await masterchef.connect(timelock).add(1000, masterToken, false);
    const poolsLength = await masterchef.poolLength();
    const pidSdtD = poolsLength - 1;
    await sdtDProxy.connect(deployer_new).initializeMasterchef(pidSdtD);
    await sdtDProxy.connect(deployer_new).setDistribution(true);
  });

  describe("Curve Vault tests", function () {
    it("Liquidity Gauge token should set properly", async function () {
        const name = await crv3MultiGauge.name();
        const symbol = await crv3MultiGauge.symbol();
        expect(name).to.be.equal("Stake DAO 3Crv Gauge");
        expect(symbol).to.be.equal("sd3Crv-gauge");
    });

    it("Should deposit 3Crv to vault and get gauge tokens", async function () {
        const amountToDeposit = parseEther("1000");
        const vault3CrvBalanceBeforeDeposit = await crv3.balanceOf(crv3Vault.address);
        await crv3.connect(crv3Holder).approve(crv3Vault.address, amountToDeposit);
        await crv3Vault.connect(crv3Holder).deposit(crv3Holder._address, amountToDeposit, false);
        const vault3CrvBalanceAfterDeposit = await crv3.balanceOf(crv3Vault.address);
        const gaugeTokenBalanceOfDepositor = await crv3MultiGauge.balanceOf(crv3Holder._address);
        expect(vault3CrvBalanceBeforeDeposit).to.be.eq(0);
        expect(vault3CrvBalanceAfterDeposit).to.be.equal(amountToDeposit);
        expect(gaugeTokenBalanceOfDepositor).to.be.equal(parseEther("999"));
    });

    it("Should be able to withdraw deposited amount and gauge tokens should be burned", async function () {
        const vault3CrvBalanceBeforeWithdraw = await crv3.balanceOf(crv3Vault.address);
        await crv3Vault.connect(crv3Holder).withdraw(parseEther("999"));
        const vault3CrvBalanceAfterWithdraw = await crv3.balanceOf(crv3Vault.address);
        const gaugeTokenBalanceOfDepositor = await crv3MultiGauge.balanceOf(crv3Holder._address);
        expect(vault3CrvBalanceBeforeWithdraw).to.be.gt(0);
        expect(vault3CrvBalanceAfterWithdraw).to.be.eq(parseEther("1"));
        expect(gaugeTokenBalanceOfDepositor).to.be.eq(0);
    });

    it("Shouldn't be able to withdraw when there is no enough gauge token", async function () {
        const amountToDeposit = parseEther("1000");
        await crv3.connect(crv3Holder).approve(crv3Vault.address, amountToDeposit);
        await crv3Vault.connect(crv3Holder).deposit(crv3Holder._address, amountToDeposit, false);
        const deployerStaked = await crv3MultiGauge.balanceOf(deployer_new._address);
        await crv3MultiGauge.connect(crv3Holder).transfer(deployer_new._address, parseEther("499"));
        const deployerStakedAfterTransfer = await crv3MultiGauge.balanceOf(deployer_new._address);
        const tx = await crv3Vault
            .connect(crv3Holder)
            .withdraw(parseEther("999"))
            .catch((e: any) => e);
        expect(tx.message).to.have.string("Not enough staked");
        expect(deployerStaked).to.be.equal(0);
        expect(deployerStakedAfterTransfer).to.be.equal(parseEther("499"));
    });

    it("it should not be able withdraw from multigauge if not vault", async () => {
        const stakedBalance = await crv3MultiGauge.balanceOf(crv3Holder._address);
        await expect(
            crv3MultiGauge.connect(crv3Holder)["withdraw(uint256,address)"](stakedBalance, crv3Holder._address)
        ).to.be.reverted;
    });

    it("Should not be able to approve vault on the strategy when not governance", async function () {
        const tx = await strategy.toggleVault(crv3Vault.address).catch((e: any) => e);
        expect(tx.message).to.have.string("!governance");
    });

    it("should not be able to add gauge if it's not governance", async function () {
        const tx = await strategy.setGauge(CRV3, CRV3_GAUGE).catch((e: any) => e);
        expect(tx.message).to.have.string("!governance");
    });

    it("Should be able to call earn therefore get accumulated fees as staked amount and stake the amounts to the Angle gauge", async function () {
        const crv3GaugeStakedBefore = await crv3LiqudityGauge.balanceOf(locker.address);
        const accumulatedFees = await crv3Vault.accumulatedFee();
        const tx = await (await crv3Vault.deposit(localDeployer.address, 0, true)).wait();
        const deployerStakedAmount = await crv3MultiGauge.balanceOf(localDeployer.address);
        const vault3CrvBalanceAfterEarn = await crv3.balanceOf(crv3Vault.address);
        const crv3GaugeStakedAfter = await crv3LiqudityGauge.balanceOf(locker.address);
        expect(crv3GaugeStakedBefore).to.be.eq(0);
        expect(crv3GaugeStakedAfter).to.be.eq(parseEther("1001"));
        expect(vault3CrvBalanceAfterEarn).to.be.equal(0);
        expect(deployerStakedAmount).to.be.eq(accumulatedFees);
    });

    it("Should pay withdraw fee if withdraw from Angle gauge", async function () {
        const amountToWithdraw = parseEther("500");
        const sanUsdcEurBalanceBeforeWithdraw = await crv3.balanceOf(crv3Holder._address);
        const tx = await (await crv3Vault.connect(crv3Holder).withdraw(amountToWithdraw)).wait();
        const crv3BalanceAfterWithdraw = await crv3.balanceOf(crv3Holder._address);
        const crv3GaugeStakedAfterWithdraw = await crv3LiqudityGauge.balanceOf(locker.address);
        const fee = amountToWithdraw.mul(50).div(10000);
        // expect(crv3BalanceAfterWithdraw.sub(sanUsdcEurBalanceBeforeWithdraw)).to.be.equal(
        //     amountToWithdraw.sub(fee)
        // );
        // expect(crv3GaugeStakedAfterWithdraw).to.be.equal(parseEther("501"));
    });

    it("should be able to claim rewards when some time pass", async () => {
        this.timeout(0)
        const amountToDeposit = parseEther("1000")
        //await gc.connect(crv3Holder).vote_for_gauge_weights(crv3MultiGauge.address, 10000);
        await crv3.connect(crv3Holder).approve(crv3Vault.address, amountToDeposit);
        await crv3Vault.connect(crv3Holder).deposit(crv3Holder._address, amountToDeposit, true);
        await sdtDProxy.connect(deployer_new).approveGauge(crv3MultiGauge.address);
        // increase the timestamp by 1 month
        await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 30]);
        await network.provider.send("evm_mine", []);
        // await gc.connect(veSdtHolder).checkpoint_gauge(sanUSDCEurMultiGauge.address);

        const multiGaugeRewardRateBefore = await crv3MultiGauge.reward_data(crv.address);
        const msCrvBalanceBefore = await crv.balanceOf(dummyMs.address);
        const accumulatorCrvBalanceBefore = await crv.balanceOf(CRV_ACCUMULATOR);
        //const claimable = await crv3LiqudityGauge.claimable_reward(locker.address, crv.address);
        // const tx = await (await strategy.claim(crv3.address)).wait();
        // // const crvGRWA = await gc["gauge_relative_weight(address)"](crv3MultiGauge.address);
        // const accumulatorCrvBalanceAfter = await crv.balanceOf(CRV_ACCUMULATOR);
        // const multiGaugeRewardRateAfter = await crv3MultiGauge.reward_data(crv.address);
        // const sdtRewardsAfter = await crv3MultiGauge.reward_data(SDT);
        // const msCrvBalanceAfter = await crv.balanceOf(dummyMs.address);
        //const perfFee = claimable.mul(BigNumber.from(200)).div(BigNumber.from(10000));
        //const accumulatorPart = claimable.mul(BigNumber.from(800)).div(BigNumber.from(10000));
        //const claimed = tx.events.find((e: any) => e.event === "Claimed");
        //const sdtBalance = await sdt.balanceOf(crv3MultiGauge.address);
        //const sdtBalanceOfDistributor = await sdt.balanceOf(sdtDProxy.address);
        //expect(claimed.args[2]).to.be.equal(claimable);
        //expect(multiGaugeRewardRateBefore[3]).to.be.equal(0);
        //expect(multiGaugeRewardRateAfter[3]).to.be.gt(0);
        //expect(sdtRewardsAfter[3]).to.be.gt(0);
        //expect(perfFee).to.be.gt(0);
        // expect(accumulatorPart).to.be.gt(0);
        //expect(msCrvBalanceAfter.sub(msCrvBalanceBefore)).to.be.equal(perfFee);
        //expect(accumulatorCrvBalanceAfter.sub(accumulatorCrvBalanceBefore)).to.be.equal(accumulatorPart);
        //expect(crvGRWA).to.be.eq(parseEther("1")); // 100%   
    });

    it("it should get maximum boost from angle liquidity gauge", async () => {
      const workingBalance = await crv3LiqudityGauge.working_balances(locker.address);
      const stakedAmount = await crv3LiqudityGauge.balanceOf(locker.address);
      const boost = workingBalance.mul(BigNumber.from(10).pow(18)).div(stakedAmount.mul(4).div(10));
      expect(boost).to.be.eq(parseEther("2.5"));
    });

    // it("it should be able swap crv and transfer to feeDistributor from veSDTFeeAngleProxy", async () => {
    //   const fraxBalanceOfClaimer = await frax.balanceOf(localDeployer.address);
    //   const sd3CrvBalanceOfFeeD = await sdFrax3Crv.balanceOf(STAKEDAO_FEE_DISTRIBUTOR);
    //   await VeSdtProxy.sendRewards();
    //   const fraxBalanceOfClaimerAfterClaim = await frax.balanceOf(localDeployer.address);
    //   const sd3CrvBalanceOfFeeDAfterRewards = await sdFrax3Crv.balanceOf(STAKEDAO_FEE_DISTRIBUTOR);
    //   expect(fraxBalanceOfClaimerAfterClaim.sub(fraxBalanceOfClaimer)).to.be.gt(0);
    //   expect(sd3CrvBalanceOfFeeDAfterRewards.sub(sd3CrvBalanceOfFeeD)).to.be.gt(0);
    // });
    
    // it("it should accumulated angle rewards to sdAngle liquidity gauge from AngleAccumulator", async () => {
    //   const gaugeAngleBalanceBefore = await angle.balanceOf(sdAngleGauge.address);
    //   await sdAngleGauge.connect(deployer).add_reward(angle.address, angleAccumulator.address);
    //   await angleAccumulator.connect(deployer).notifyAllExtraReward(angle.address);
    //   const gaugeAngleBalanceAfter = await angle.balanceOf(sdAngleGauge.address);
    //   const angleAccumulatorBalance = await angle.balanceOf(angleAccumulator.address);
    //   expect(gaugeAngleBalanceAfter.sub(gaugeAngleBalanceBefore)).to.be.gt(0);
    //   expect(angleAccumulatorBalance).to.be.equal(0);
    // });
    // it("it should create new vault and multigauge rewards for different Angle LP token", async () => {
    //   const cloneTx = await (await angleVaultFactoryContract.cloneAndInit(sanDAI_EUR_GAUGE)).wait();
    //   sanDaiEurVault = await ethers.getContractAt("AngleVault", cloneTx.events[0].args[0]);

    //   const gauge = cloneTx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];

    //   sanDaiEurMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge);
    //   const tokenOfVault = await sanDaiEurVault.token();
    //   // add sanDaiEur gauge to gaugecontroller
    //   await gc.connect(deployer)["add_gauge(address,int128,uint256)"](sanDaiEurMultiGauge.address, 0, 0); // gauge - type - weight
    //   await sdtDProxy.connect(deployer).approveGauge(sanDaiEurMultiGauge.address);
    //   expect(tokenOfVault.toLowerCase()).to.be.equal(SAN_DAI_EUR.toLowerCase());
    // });
    // it("it should be able to deposit sanDAIEur to new vault", async () => {
    //   const gaugeTokenBalanceBeforeDeposit = await sanDaiEurMultiGauge.balanceOf(sanDAILPHolder._address);
    //   await sanDaiEur.connect(sanDAILPHolder).approve(sanDaiEurVault.address, ethers.constants.MaxUint256);
    //   await sanDaiEurVault.connect(sanDAILPHolder).deposit(sanDAILPHolder._address, parseEther("10000"), false);
    //   const gaugeTokenBalanceAfterDeposit = await sanDaiEurMultiGauge.balanceOf(sanDAILPHolder._address);
    //   expect(gaugeTokenBalanceBeforeDeposit).to.be.equal(0);
    //   expect(gaugeTokenBalanceAfterDeposit.sub(gaugeTokenBalanceBeforeDeposit)).to.be.equal(parseEther("9990"));
    // });
    // it("it should send tokens to angle gauge after call earn for new vault", async () => {
    //   const sanDaiEurAngleGaugeStakedBefore = await sanDaiEurLiqudityGauge.balanceOf(locker.address);
    //   await (await sanDaiEurVault.deposit(localDeployer.address, 0, true)).wait();
    //   const sanUsdcEurAngleGaugeStakedAfter = await sanDaiEurLiqudityGauge.balanceOf(locker.address);
    //   expect(sanDaiEurAngleGaugeStakedBefore).to.be.equal(0);
    //   expect(sanUsdcEurAngleGaugeStakedAfter).to.be.equal(parseEther("10000"));
    // });
    // it("it should transfer governance of locker by execute function through angleStrategy", async () => {
    //   let setGovernanceFunction = ["function setGovernance(address _governance)"];
    //   let iSetGovernance = new ethers.utils.Interface(setGovernanceFunction);
    //   const data = iSetGovernance.encodeFunctionData("setGovernance", [dummyMs.address]);
    //   await strategy.connect(deployer).execute(locker.address, 0, data);
    //   const newGovernance = await locker.governance();
    //   expect(newGovernance).to.be.equal(dummyMs.address);
    // });
//     it("It should distribute for one gauge for during 44 days then it should distribute other gauge rewards at once for 44days ", async () => {
//       await gc.connect(veSdtHolder).vote_for_gauge_weights(sanUSDCEurMultiGauge.address, 5000);
//       await gc.connect(veSdtHolder).vote_for_gauge_weights(sanDaiEurMultiGauge.address, 5000);
//       // increase the timestamp by 1 week
//       await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]);
//       await network.provider.send("evm_mine", []);
//       await sanDaiEurLiqudityGauge
//         .connect(angleDistributor)
//         .deposit_reward_token(ANGLE, ethers.utils.parseEther("10000"));
//       await strategy.claim(sanDaiEur.address);

//       for (let i = 0; i < 44; i++) {
//         await network.provider.send("evm_increaseTime", [60 * 60 * 24]);
//         await network.provider.send("evm_mine", []);
//         await strategy.claim(sanDaiEur.address);
//         if (i % 7 == 0) {
//           await sanDaiEurLiqudityGauge
//             .connect(angleDistributor)
//             .deposit_reward_token(ANGLE, ethers.utils.parseEther("10000"));
//           await sanUsdcEurLiqudityGauge
//             .connect(angleDistributor)
//             .deposit_reward_token(ANGLE, ethers.utils.parseEther("10000"));
//         }
//       }
//       await strategy.claim(sanUsdcEur.address);
//       const sdtBalanceOfDistributor = await sdt.balanceOf(sdtDProxy.address);
//       expect(sdtBalanceOfDistributor).to.be.equal(0);
//     });

//     it("should distribute to gauge", async () => {});
    });
});
