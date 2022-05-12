import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";
import ERC20ABI from "./fixtures/ERC20.json";
import LGV1ABI from "./fixtures/LGV1.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, parseUnits } from "@ethersproject/units";
import CrvLockerABI from "./fixtures/crvLocker.json";
import { SDFRAX3CRV } from "./constant";
const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const SDT_HOLDER = "0x40FeD1b6f25DE00Ff9745E0158C333EB46d33A5D";

const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const SDCRVGAUGE = "0x7f50786A0b15723D741727882ee99a0BF34e3466";
const STAKEDAO_FEE_DISTRIBUTOR = "0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92";

const CRV_ACCUMULATOR = "0x54C7757199c4A04BCcD1472Ad396f768D8173757";
const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";

// Curve LPs Gauge
const CRV3 = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490"; // LP
const CRV3_GAUGE = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A"; // LGV1
//const SDCRV_CRV = "0xf7b55C3732aD8b2c2dA7c24f30A69f55c54FB717" // LP
//const SDCRV_CRV_GAUGE = "0x663FC22e92f26C377Ddf3C859b560C4732ee639a"; // LGV4
const SDT_ETH = "0x6359B6d3e327c497453d4376561eE276c6933323"; // LP
const SDT_ETH_GAUGE = "0x60355587a8D4aa67c2E64060Ab36e566B9bCC000"; // LGV4

const CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const SUSHI = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2";
//const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const CRV3_HOLDER = "0x701aEcF92edCc1DaA86c5E7EdDbAD5c311aD720C";

const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";

const VESDT_HOLDER = "0xdceb0bb3311342e3ce9e49f57affce9deac40ba1";
const CRV_LOCKER = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";
const GC_STRATEGY = "0x3F3F0776D411eb97Cfa4E3eb25F33c01ca4e7Ca8";
const SDT_D_STRATEGY = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
const DEPLOYER_NEW = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";
const SD_CRV_LG = "0x7f50786A0b15723D741727882ee99a0BF34e3466";

const SD_FRAX_3CRV = "0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7";

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("CURVE Strategy", function () {
  let locker: Contract;
  let crv: Contract;
  let frax: Contract;
  let sdt: Contract;
  let veSdt: Contract;
  let deployer: JsonRpcSigner;
  let deployer_new: JsonRpcSigner;
  let dummyMs: SignerWithAddress;
  let VeSdtProxy: Contract;
  let crv3Holder: JsonRpcSigner;
  //let sdCrvCrvHolder: JsonRpcSigner;
  let localDeployer: SignerWithAddress;
  let strategy: Contract;
  let crv3: Contract; // LP
  let crv3Vault: Contract; // Vault
  let crv3MultiGauge: Contract; // sd LGV4
  let crv3LG: Contract; // curve LG
  //let sdCrvCrv: Contract;
  //let sdCrvCrvVault: Contract;
  //let sdCrvCrvMultiGauge: Contract;
  //let sdCrvCrvLG: Contract;
  let sdtEth: Contract;
  let sdtEthVault: Contract;
  let sdtEthMultiGauge: Contract;
  let sdtEthLG: Contract;
  let sdCrvLG: Contract;
  let curveVaultFactoryContract: Contract;
  let sdFrax3Crv: Contract;
  let sdCrvGauge: Contract;
  let crvAccumulator: Contract;
  let sdtDistributor: Contract;
  let gc: Contract;
  let sdtDProxy: Contract;
  let timelock: JsonRpcSigner;
  let veSdtHolder: JsonRpcSigner;
  let sdtHolder: JsonRpcSigner;
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
      params: [SDT_HOLDER]
    });

    const CurveStrategy = await ethers.getContractFactory("CurveStrategy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    deployer = ethers.provider.getSigner(STDDEPLOYER);
    deployer_new = ethers.provider.getSigner(DEPLOYER_NEW);
    crv3Holder = ethers.provider.getSigner(CRV3_HOLDER);
    timelock = await ethers.provider.getSigner(TIMELOCK);
    veSdtHolder = await ethers.provider.getSigner(VESDT_HOLDER);
    sdtHolder = await ethers.provider.getSigner(SDT_HOLDER);
    await network.provider.send("hardhat_setBalance", [CRV3_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [VESDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [DEPLOYER_NEW, ETH_100]);
    await network.provider.send("hardhat_setBalance", [STDDEPLOYER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [SDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [timelock._address, parseEther("10").toHexString()]);

    locker = await ethers.getContractAt(CrvLockerABI, CRV_LOCKER);
    crv3 = await ethers.getContractAt(ERC20ABI, CRV3);
    crv = await ethers.getContractAt(ERC20ABI, CRV);
    frax = await ethers.getContractAt(ERC20ABI, FRAX);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    sdFrax3Crv = await ethers.getContractAt(ERC20ABI, SDFRAX3CRV);
    sdCrvGauge = await ethers.getContractAt("LiquidityGaugeV4", SDCRVGAUGE);
    crvAccumulator = await ethers.getContractAt("CurveAccumulator", CRV_ACCUMULATOR);
    const veSdtCurveProxyFactory = await ethers.getContractFactory("VeSdtFeeCurveProxy");
    gc = await ethers.getContractAt("GaugeController", GC_STRATEGY)
    veSdt = await ethers.getContractAt("veSDT", VE_SDT);
    sdCrvLG = await ethers.getContractAt("LiquidityGaugeV4", SD_CRV_LG);
    VeSdtProxy = await veSdtCurveProxyFactory.deploy([CRV, WETH, SUSHI, FRAX]);

    const proxyAdmin = await ProxyAdmin.deploy();

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

    const liquidityGaugeFactory = await ethers.getContractFactory("LiquidityGaugeV4Strat");
    const liquidityGaugeStratImp = await liquidityGaugeFactory.deploy();
    const curveVaultFactory = await ethers.getContractFactory("CurveVaultFactory");

    curveVaultFactoryContract = await curveVaultFactory.deploy(
      liquidityGaugeStratImp.address,
      strategy.address,
      sdtDProxy.address
    );
    await strategy.connect(deployer).setVaultGaugeFactory(curveVaultFactoryContract.address);

    // Clone vaults
    // 3crv (LGV1)
    const cloneTx3Crv = await (await curveVaultFactoryContract.cloneAndInit(CRV3_GAUGE)).wait();
    const gauge3Crv= cloneTx3Crv.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    crv3Vault = await ethers.getContractAt("CurveVault", cloneTx3Crv.events[0].args[0]);
    crv3MultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge3Crv);
    crv3LG = await ethers.getContractAt(LGV1ABI, CRV3_GAUGE);

    // sdCrvCrv (LGV4)
    // const cloneTxSdCrvCrv = await (await curveVaultFactoryContract.cloneAndInit(SDCRV_CRV_GAUGE)).wait();
    // const gaugeSdCrvCrv = cloneTxSdCrvCrv.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    // sdCrvCrvVault = await ethers.getContractAt("CurveVault", cloneTxSdCrvCrv.events[0].args[0]);
    // sdCrvCrvMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gaugeSdCrvCrv);
    // sdCrvCrvLG = await ethers.getContractAt("LiquidityGaugeV4", SDCRV_CRV_GAUGE);

    // sdtEth (LGV4)
    const cloneTxSdtEth = await (await curveVaultFactoryContract.cloneAndInit(SDT_ETH_GAUGE)).wait();
    const gaugeSdtEth = cloneTxSdtEth.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    sdtEthVault = await ethers.getContractAt("CurveVault", cloneTxSdtEth.events[0].args[0]);
    sdtEthMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gaugeSdtEth);
    sdtEthLG = await ethers.getContractAt("LiquidityGaugeV4", SDT_ETH_GAUGE);

    // Add gauge types
    const typesWeight = parseEther("1");
    await gc.connect(deployer_new)["add_type(string,uint256)"]("Mainnet staking", typesWeight); // 0
    await gc.connect(deployer_new)["add_type(string,uint256)"]("External", typesWeight); // 1
    await gc.connect(deployer_new)["add_type(string,uint256)"]("Cross Chain", typesWeight); // 2

    // add 3crv gauge to gaugecontroller
    await gc.connect(deployer_new)["add_gauge(address,int128,uint256)"](crv3MultiGauge.address, 0, 0); // gauge - type - weight
    await gc.connect(deployer_new)["add_gauge(address,int128,uint256)"](sdtEthMultiGauge.address, 0, 0);

    /** Masterchef <> SdtDistributor setup */
    /** Already set it up */

    // Send SDT to the 3crv holder and create a lock
    const sdtToLock = parseEther("100");
    await sdt.connect(sdtHolder).transfer(crv3Holder._address, sdtToLock);
    await sdt.connect(crv3Holder).approve(veSdt.address, sdtToLock);
    await veSdt.connect(crv3Holder).create_lock(sdtToLock, 1657345737);
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

    it("Should be able to call earn therefore get accumulated fees as staked amount and stake the amounts to the Curve gauge", async function () {
        const crv3GaugeStakedBefore = await crv3LG.balanceOf(locker.address);
        const accumulatedFees = await crv3Vault.accumulatedFee();
        const tx = await (await crv3Vault.deposit(localDeployer.address, 0, true)).wait();
        const deployerStakedAmount = await crv3MultiGauge.balanceOf(localDeployer.address);
        const vault3CrvBalanceAfterEarn = await crv3.balanceOf(crv3Vault.address);
        const crv3GaugeStakedAfter = await crv3LG.balanceOf(locker.address);
        expect(crv3GaugeStakedBefore).to.be.eq(0);
        expect(crv3GaugeStakedAfter).to.be.eq(parseEther("1001"));
        expect(vault3CrvBalanceAfterEarn).to.be.equal(0);
        expect(deployerStakedAmount).to.be.eq(accumulatedFees);
    });

    it("Should pay withdraw fee if withdraw from Cruve gauge", async function () {
        const amountToWithdraw = parseEther("500");
        const sanUsdcEurBalanceBeforeWithdraw = await crv3.balanceOf(crv3Holder._address);
        const tx = await (await crv3Vault.connect(crv3Holder).withdraw(amountToWithdraw)).wait();
        const crv3BalanceAfterWithdraw = await crv3.balanceOf(crv3Holder._address);
        const crv3GaugeStakedAfterWithdraw = await crv3LG.balanceOf(locker.address);
        const fee = amountToWithdraw.mul(50).div(10000);
        // expect(crv3BalanceAfterWithdraw.sub(sanUsdcEurBalanceBeforeWithdraw)).to.be.equal(
        //     amountToWithdraw.sub(fee)
        // );
        // expect(crv3GaugeStakedAfterWithdraw).to.be.equal(parseEther("501"));
    });

    it("should be able to claim rewards when some time pass", async () => {
        const amountToDeposit = parseEther("1000")
        await gc.connect(crv3Holder).vote_for_gauge_weights(crv3MultiGauge.address, 10000);
        await crv3.connect(crv3Holder).approve(crv3Vault.address, amountToDeposit);
        await crv3Vault.connect(crv3Holder).deposit(crv3Holder._address, amountToDeposit, true);
        await sdtDProxy.connect(deployer_new).approveGauge(crv3MultiGauge.address);
        // increase the timestamp by 1 month
        await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
        await network.provider.send("evm_mine", []);
        await gc.connect(crv3Holder).checkpoint_gauge(crv3MultiGauge.address);

        const multiGaugeRewardRateBefore = await crv3MultiGauge.reward_data(crv.address);
        const msCrvBalanceBefore = await crv.balanceOf(dummyMs.address);
        const accumulatorCrvBalanceBefore = await crv.balanceOf(CRV_ACCUMULATOR);
        //const claimable = await crv3LiqudityGauge.claimable_reward(locker.address, crv.address);
        const gaugeType = await strategy.lGaugeType(crv3LG.address);
        //console.log(gaugeType);
        const tx = await (await strategy.claim(crv3.address)).wait();
        // const crvGRWA = await gc["gauge_relative_weight(address)"](crv3MultiGauge.address);
        // const accumulatorCrvBalanceAfter = await crv.balanceOf(CRV_ACCUMULATOR);
        // const multiGaugeRewardRateAfter = await crv3MultiGauge.reward_data(crv.address);
        // const sdtRewardsAfter = await crv3MultiGauge.reward_data(SDT);
        // const msCrvBalanceAfter = await crv.balanceOf(dummyMs.address);
        // //const perfFee = claimable.mul(BigNumber.from(200)).div(BigNumber.from(10000));
        // //const accumulatorPart = claimable.mul(BigNumber.from(800)).div(BigNumber.from(10000));
        // //const claimed = tx.events.find((e: any) => e.event === "Claimed");
        // const sdtBalance = await sdt.balanceOf(crv3MultiGauge.address);
        // const sdtBalanceOfDistributor = await sdt.balanceOf(sdtDProxy.address);
        //expect(claimed.args[2]).to.be.equal(claimable);
        // expect(multiGaugeRewardRateBefore[3]).to.be.equal(0);
        // expect(multiGaugeRewardRateAfter[3]).to.be.gt(0);
        // expect(sdtRewardsAfter[3]).to.be.gt(0);
        //expect(perfFee).to.be.gt(0);
        //expect(accumulatorPart).to.be.gt(0);
        //expect(msCrvBalanceAfter.sub(msCrvBalanceBefore)).to.be.equal(perfFee);
        //expect(accumulatorCrvBalanceAfter.sub(accumulatorCrvBalanceBefore)).to.be.equal(accumulatorPart);
        //expect(crvGRWA).to.be.eq(parseEther("1")); // 100%   
    }).timeout(0);

    it("it should claim 3crv weekly reward", async () => {
      // Claim weekly 3crv reward for the CRV Locker 
      const crv3BalanceBeforeInLG = await crv3.balanceOf(SD_CRV_LG);
      await strategy.claim3Crv(true);
      const crv3BalanceAfterInLG = await crv3.balanceOf(SD_CRV_LG);
      expect(crv3BalanceAfterInLG).gt(crv3BalanceBeforeInLG);
    });

    it("it should get maximum boost from curve liquidity gauge", async () => {
      const workingBalance = await crv3LG.working_balances(locker.address);
      const stakedAmount = await crv3LG.balanceOf(locker.address);
      const boost = workingBalance.mul(BigNumber.from(10).pow(18)).div(stakedAmount.mul(4).div(10));
      expect(boost).to.be.eq(parseEther("2.5"));
    });

    it("it should be able swap crv and transfer to feeDistributor from veSDTFeeCrvProxy", async () => {
      const fraxBalanceOfClaimer = await frax.balanceOf(localDeployer.address);
      const sd3CrvBalanceOfFeeD = await sdFrax3Crv.balanceOf(STAKEDAO_FEE_DISTRIBUTOR);
      const crvProxyBalanceBefore = await crv.balanceOf(VeSdtProxy.address);
      expect(crvProxyBalanceBefore).gt(0);
      await VeSdtProxy.sendRewards();
      const crvProxyBalanceAfter = await crv.balanceOf(VeSdtProxy.address);
      expect(crvProxyBalanceAfter).eq(0);
    });
    
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
