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
import { parse } from "path";
const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

// ERC20
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const SUSHI = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2";

// Curve LPs Gauge
const CRV3 = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490"; // LP
const CRV3_GAUGE = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A"; // LGV1
const EUR3 = "0xb9446c4Ef5EBE66268dA6700D26f96273DE3d571" // LP
const EUR3_GAUGE = "0x1E212e054d74ed136256fc5a5DDdB4867c6E003F"; // LGV4
const SDT_ETH = "0x6359B6d3e327c497453d4376561eE276c6933323"; // LP
const SDT_ETH_GAUGE = "0x60355587a8D4aa67c2E64060Ab36e566B9bCC000"; // LGV4 without extra rewards
const STECRV = "0x06325440D014e39736583c165C2963BA99fAf14E";
const STECRV_GAUGE = "0x182B723a58739a9c974cFDB385ceaDb237453c28";

// Signers
const SDT_HOLDER = "0x40FeD1b6f25DE00Ff9745E0158C333EB46d33A5D";
const CRV3_HOLDER = "0x701aEcF92edCc1DaA86c5E7EdDbAD5c311aD720C";
const EUR3_HOLDER = "0x863ddd1c07866c8270141387af223c93b52c057e";
const SDT_ETH_HOLDER = "0xB86662739e1aCC01d9Ca9c3C3dcFb34ae3f0332e";
const STECRV_HOLDER = "0x56c915758Ad3f76Fd287FFF7563ee313142Fb663";
const VESDT_HOLDER = "0xdceb0bb3311342e3ce9e49f57affce9deac40ba1";
const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
const DEPLOYER_NEW = "0x0dE5199779b43E13B3Bec21e91117E18736BC1A8";

// StakeDAO contracts
const CRV_LOCKER = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";
const GC_STRATEGY = "0x3F3F0776D411eb97Cfa4E3eb25F33c01ca4e7Ca8";
const SDT_D_STRATEGY = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
const SDCRVGAUGE = "0x7f50786A0b15723D741727882ee99a0BF34e3466";
const SD_FRAX_3CRV = "0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7";
const LGV4_STRAT_IMPL = "0x3dc56d46f0bd13655efb29594a2e44534c453bf9";
const CRV_ACCUMULATOR = "0x54C7757199c4A04BCcD1472Ad396f768D8173757";
const STAKEDAO_FEE_DISTRIBUTOR = "0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92";

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
  let localDeployer: SignerWithAddress;
  let strategy: Contract;
  let crv3: Contract; // LP
  let crv3Vault: Contract; // Vault
  let crv3MultiGauge: Contract; // sd LGV4
  let crv3LG: Contract; // curve LG
  let eur3: Contract; // 3EUR
  let eur3Vault: Contract;
  let eur3MultiGauge: Contract;
  let eur3LG: Contract;
  let steCrv: Contract;
  let steCrvVault: Contract;
  let steCrvMultiGauge: Contract;
  let steCrvLG: Contract;
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
  let eur3Holder: JsonRpcSigner;
  let sdtEthHolder: JsonRpcSigner;
  let steCrvHolder: JsonRpcSigner;
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
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [EUR3_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STECRV_HOLDER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDT_ETH_HOLDER]
    });

    const CurveStrategy = await ethers.getContractFactory("CurveStrategy");
    const veSdtCurveProxyFactory = await ethers.getContractFactory("VeSdtFeeCurveProxy");
    const curveVaultFactory = await ethers.getContractFactory("CurveVaultFactory");

    deployer = ethers.provider.getSigner(STDDEPLOYER);
    deployer_new = ethers.provider.getSigner(DEPLOYER_NEW);
    crv3Holder = ethers.provider.getSigner(CRV3_HOLDER);
    timelock = await ethers.provider.getSigner(TIMELOCK);
    veSdtHolder = await ethers.provider.getSigner(VESDT_HOLDER);
    sdtHolder = await ethers.provider.getSigner(SDT_HOLDER);
    eur3Holder = await ethers.provider.getSigner(EUR3_HOLDER);
    sdtEthHolder = await ethers.provider.getSigner(SDT_ETH_HOLDER);
    steCrvHolder = await ethers.provider.getSigner(STECRV_HOLDER);

    // Set Eth balance to signers
    await network.provider.send("hardhat_setBalance", [CRV3_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [VESDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [DEPLOYER_NEW, ETH_100]);
    await network.provider.send("hardhat_setBalance", [STDDEPLOYER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [SDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [EUR3_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [STECRV_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [SDT_ETH_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [timelock._address, ETH_100]);

    // Get contracts already deployed on mainnets
    locker = await ethers.getContractAt(CrvLockerABI, CRV_LOCKER);
    crv3 = await ethers.getContractAt(ERC20ABI, CRV3);
    crv = await ethers.getContractAt(ERC20ABI, CRV);
    frax = await ethers.getContractAt(ERC20ABI, FRAX);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    eur3 = await ethers.getContractAt(ERC20ABI, EUR3);
    sdFrax3Crv = await ethers.getContractAt(ERC20ABI, SDFRAX3CRV);
    sdCrvGauge = await ethers.getContractAt("LiquidityGaugeV4", SDCRVGAUGE);
    crvAccumulator = await ethers.getContractAt("CurveAccumulator", CRV_ACCUMULATOR);
    gc = await ethers.getContractAt("GaugeController", GC_STRATEGY);
    veSdt = await ethers.getContractAt("veSDT", VE_SDT);
    sdtDProxy = await ethers.getContractAt("SdtDistributorV2", SDT_D_STRATEGY);
    const liquidityGaugeStratImp = await ethers.getContractAt("LiquidityGaugeV4Strat", LGV4_STRAT_IMPL)

    // Deploy new contracts 
    VeSdtProxy = await veSdtCurveProxyFactory.deploy([CRV, WETH, SUSHI, FRAX]);
    strategy = await CurveStrategy.connect(deployer_new).deploy(
      locker.address,
      deployer._address,
      dummyMs.address,
      CRV_ACCUMULATOR,
      VeSdtProxy.address,
      sdtDProxy.address
    );
    curveVaultFactoryContract = await curveVaultFactory.deploy(
      liquidityGaugeStratImp.address,
      strategy.address,
      sdtDProxy.address
    );

    // change crvLocker's strategy address to the curve strategy address 
    // NB we have to set it using the multisig on mainnet
    await network.provider.send("hardhat_setStorageAt", [
        locker.address,
        "0x1",
        "0x000000000000000000000000" + strategy.address.substring(2),
    ]);

    // Setter on strategy contract
    await strategy.connect(deployer).setVaultGaugeFactory(curveVaultFactoryContract.address);

    // Clone vaults
    // 3crv (LGV1)
    const cloneTx3Crv = await (await curveVaultFactoryContract.cloneAndInit(CRV3_GAUGE)).wait();
    const gauge3Crv = cloneTx3Crv.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    crv3Vault = await ethers.getContractAt("CurveVault", cloneTx3Crv.events[0].args[0]);
    crv3MultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge3Crv);
    crv3LG = await ethers.getContractAt(LGV1ABI, CRV3_GAUGE);

    // sdtEth (LGV4)
    const cloneTxSdtEth = await (await curveVaultFactoryContract.cloneAndInit(SDT_ETH_GAUGE)).wait();
    const gaugeSdtEth = cloneTxSdtEth.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    sdtEthVault = await ethers.getContractAt("CurveVault", cloneTxSdtEth.events[0].args[0]);
    sdtEthMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gaugeSdtEth);
    sdtEthLG = await ethers.getContractAt("LiquidityGaugeV4", SDT_ETH_GAUGE);

    // add 3crv gauge to the gaugecontroller for strategies
    await gc.connect(deployer_new)["add_gauge(address,int128,uint256)"](crv3MultiGauge.address, 0, 0); // gauge - type - weight
    await gc.connect(deployer_new)["add_gauge(address,int128,uint256)"](sdtEthMultiGauge.address, 0, 0);

    /** Masterchef <> SdtDistributor setup */
    /** Already set it up */

    // Send SDT to the 3crv holder and create a lock
    const sdtToLock = parseEther("10");
    await sdt.connect(sdtHolder).transfer(crv3Holder._address, sdtToLock);
    await sdt.connect(sdtHolder).transfer(eur3Holder._address, sdtToLock);
    await sdt.connect(crv3Holder).approve(veSdt.address, sdtToLock);
    await sdt.connect(eur3Holder).approve(veSdt.address, sdtToLock);
    await veSdt.connect(crv3Holder).create_lock(sdtToLock, await getNow() + ONE_YEAR_IN_SECONDS);
    await veSdt.connect(eur3Holder).create_lock(sdtToLock, await getNow() + ONE_YEAR_IN_SECONDS);

    // Transfer LPs to test the different boosting
    const amountToTransfer = parseEther("10");
    await crv3.connect(crv3Holder).transfer(steCrvHolder._address, parseEther("1000"));
    await eur3.connect(eur3Holder).transfer(sdtEthHolder._address, parseEther("10"));
  });

  describe("Curve Vault tests", function () {
    it("Vaults and LG token should be set properly", async function () {
        const name3CrvMG = await crv3MultiGauge.name();
        const symbol3CrvMG = await crv3MultiGauge.symbol();
        const name3CrvVault = await crv3Vault.name();
        const symbol3CrvVault = await crv3Vault.symbol();
        const token3CrvVault = await crv3Vault.token();
        const strategy3CrvVault = await crv3Vault.curveStrategy();
        expect(name3CrvMG).to.be.equal("Stake DAO 3Crv Gauge");
        expect(symbol3CrvMG).to.be.equal("sd3Crv-gauge");
        expect(name3CrvVault).eq("sdCurve.fi DAI/USDC/USDT Vault");
        expect(symbol3CrvVault).eq("sd3Crv-vault");
        expect(token3CrvVault).eq(CRV3);
        expect(strategy3CrvVault).eq(strategy.address)
        const nameSdtEthMG = await sdtEthMultiGauge.name();
        const symbolSdtEthMG = await sdtEthMultiGauge.symbol();
        const nameSdtEthVault = await sdtEthVault.name();
        const symbolSdtEthVault = await sdtEthVault.symbol();
        const tokenSdtEthVault = await sdtEthVault.token();
        const strategySdtEthVault = await sdtEthVault.curveStrategy();
        expect(nameSdtEthMG).to.be.equal("Stake DAO SDTETH-f Gauge");
        expect(symbolSdtEthMG).to.be.equal("sdSDTETH-f-gauge");
        expect(nameSdtEthVault).eq("sdCurve.fi Factory Crypto Pool: SDT/ETH Vault");
        expect(symbolSdtEthVault).eq("sdSDTETH-f-vault");
        expect(tokenSdtEthVault).eq(SDT_ETH);
        expect(strategySdtEthVault).eq(strategy.address) 
    });

    it("Should deposit 3Crv to vault and get gauge tokens", async function () {
        const amountToDeposit = parseEther("1000");
        const vault3CrvBalanceBeforeDeposit = await crv3.balanceOf(crv3Vault.address);
        const vaultKeeperFee = await crv3Vault.keeperFee();
        const maxFee = await crv3Vault.MAX();
        
        // deposit to vault without earn (crv3Holder)
        await crv3.connect(crv3Holder).approve(crv3Vault.address, amountToDeposit.mul(4));
        await crv3Vault.connect(crv3Holder).deposit(crv3Holder._address, amountToDeposit, false);
        const vault3CrvBalanceAfterDeposit = await crv3.balanceOf(crv3Vault.address);
        const gaugeTokenBalanceOfDepositor = await crv3MultiGauge.balanceOf(crv3Holder._address);
        expect(vault3CrvBalanceBeforeDeposit).to.be.eq(0);
        expect(vault3CrvBalanceAfterDeposit).to.be.equal(amountToDeposit);
        const amountForKeeper = amountToDeposit.div(maxFee).mul(vaultKeeperFee);
        const amountForUser = amountToDeposit.sub(amountForKeeper);
        expect(gaugeTokenBalanceOfDepositor).to.be.equal(amountForUser);

        // deposit to vault with earn (steCrvHolder)
        await crv3.connect(steCrvHolder).approve(crv3Vault.address, amountToDeposit);
        await crv3Vault.connect(steCrvHolder).deposit(steCrvHolder._address, amountToDeposit, true);
        const vault3CrvBalanceAfterDeposit2 = await crv3.balanceOf(crv3Vault.address);
        expect(vault3CrvBalanceAfterDeposit2).eq(0);
        const gaugeTokenBalanceOfDepositor2 = await crv3MultiGauge.balanceOf(steCrvHolder._address);
        expect(gaugeTokenBalanceOfDepositor2).eq(amountToDeposit.add(amountForKeeper));

        // deposit to vault for another users
        await crv3Vault.connect(crv3Holder).deposit(sdtEthHolder._address, amountToDeposit, true);
        const vault3CrvBalanceAfterDeposit3 = await crv3.balanceOf(crv3Vault.address);
        expect(vault3CrvBalanceAfterDeposit3).eq(0);
        await crv3Vault.connect(crv3Holder).deposit(eur3Holder._address, amountToDeposit, true);
        const vault3CrvBalanceAfterDeposit4 = await crv3.balanceOf(crv3Vault.address);
        expect(vault3CrvBalanceAfterDeposit4).eq(0);
        await crv3Vault.connect(crv3Holder).deposit(steCrvHolder._address, amountToDeposit, false);
        const vault3CrvBalanceAfterDeposit5 = await crv3.balanceOf(crv3Vault.address);
        expect(vault3CrvBalanceAfterDeposit5).eq(amountToDeposit);
    });

    it("Should claim CRV reward after some times", async function () {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
      await network.provider.send("evm_mine", []);
      const crvBefore = await crv.balanceOf(crv3MultiGauge.address)
      expect(crvBefore).eq(0);
      await strategy.claim(crv3.address);
      const crvClaimed = await crv.balanceOf(crv3MultiGauge.address)
      expect(crvClaimed).gt(0);
    });

    it("Should be able to withdraw deposited amount and gauge tokens should be burned", async function () {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
      await network.provider.send("evm_mine", []);
      // Witdraw some funds but not the whole amount (crv3Holder)
      const amountToWitdraw = parseEther("500");
      const vault3CrvBalanceBeforeWithdraw = await crv3.balanceOf(crv3Vault.address);
      const gauge3CrvBalanceBeforeWithdraw = await crv3MultiGauge.balanceOf(crv3Holder._address);
      expect(gauge3CrvBalanceBeforeWithdraw).eq(parseEther("999"));
      expect(vault3CrvBalanceBeforeWithdraw).eq(parseEther("1000"));
      await crv3Vault.connect(crv3Holder).withdraw(amountToWitdraw);
      const vault3CrvBalanceAfterWithdraw = await crv3.balanceOf(crv3Vault.address);
      expect(vault3CrvBalanceAfterWithdraw).eq(amountToWitdraw);
      const gauge3CrvBalanceAfterWithdraw = await crv3MultiGauge.balanceOf(crv3Holder._address);
      expect(gauge3CrvBalanceAfterWithdraw).eq(parseEther("499"))
      // Withdraw all funds 
      await crv3Vault.connect(eur3Holder).withdraw(amountToWitdraw.mul(2));
      const vault3CrvBalanceAfterWithdraw2 = await crv3.balanceOf(crv3Vault.address);
      console.log(vault3CrvBalanceAfterWithdraw2.toString());
      const gauge3CrvBalanceAfterWithdraw2 = await crv3MultiGauge.balanceOf(eur3Holder._address);
      console.log(gauge3CrvBalanceAfterWithdraw2.toString());
        // expect(vault3CrvBalanceBeforeWithdraw).to.be.gt(0);
        // expect(vault3CrvBalanceAfterWithdraw).to.be.eq(parseEther("1"));
        // expect(gaugeTokenBalanceOfDepositor).to.be.eq(0);
    });

    // it("Shouldn't be able to withdraw when there is no enough gauge token", async function () {
    //     const amountToDeposit = parseEther("1000");
    //     await crv3.connect(crv3Holder).approve(crv3Vault.address, amountToDeposit);
    //     await crv3Vault.connect(crv3Holder).deposit(crv3Holder._address, amountToDeposit, false);
    //     const deployerStaked = await crv3MultiGauge.balanceOf(deployer_new._address);
    //     await crv3MultiGauge.connect(crv3Holder).transfer(deployer_new._address, parseEther("499"));
    //     const deployerStakedAfterTransfer = await crv3MultiGauge.balanceOf(deployer_new._address);
    //     const tx = await crv3Vault
    //         .connect(crv3Holder)
    //         .withdraw(parseEther("999"))
    //         .catch((e: any) => e);
    //     expect(tx.message).to.have.string("Not enough staked");
    //     expect(deployerStaked).to.be.equal(0);
    //     expect(deployerStakedAfterTransfer).to.be.equal(parseEther("499"));
    // });

    // it("it should not be able withdraw from multigauge if not vault", async () => {
    //     const stakedBalance = await crv3MultiGauge.balanceOf(crv3Holder._address);
    //     await expect(
    //         crv3MultiGauge.connect(crv3Holder)["withdraw(uint256,address)"](stakedBalance, crv3Holder._address)
    //     ).to.be.reverted;
    // });

    // it("Should not be able to approve vault on the strategy when not governance", async function () {
    //     const tx = await strategy.toggleVault(crv3Vault.address).catch((e: any) => e);
    //     expect(tx.message).to.have.string("!governance");
    // });

    // it("should not be able to add gauge if it's not governance", async function () {
    //     const tx = await strategy.setGauge(CRV3, CRV3_GAUGE).catch((e: any) => e);
    //     expect(tx.message).to.have.string("!governance");
    // });

    // it("Should be able to call earn therefore get accumulated fees as staked amount and stake the amounts to the Curve gauge", async function () {
    //     const crv3GaugeStakedBefore = await crv3LG.balanceOf(locker.address);
    //     const accumulatedFees = await crv3Vault.accumulatedFee();
    //     const tx = await (await crv3Vault.deposit(localDeployer.address, 0, true)).wait();
    //     const deployerStakedAmount = await crv3MultiGauge.balanceOf(localDeployer.address);
    //     const vault3CrvBalanceAfterEarn = await crv3.balanceOf(crv3Vault.address);
    //     const crv3GaugeStakedAfter = await crv3LG.balanceOf(locker.address);
    //     expect(crv3GaugeStakedBefore).to.be.eq(0);
    //     expect(crv3GaugeStakedAfter).to.be.eq(parseEther("1001"));
    //     expect(vault3CrvBalanceAfterEarn).to.be.equal(0);
    //     expect(deployerStakedAmount).to.be.eq(accumulatedFees);
    // });

    // it("Should pay withdraw fee if withdraw from Cruve gauge", async function () {
    //     const amountToWithdraw = parseEther("500");
    //     const sanUsdcEurBalanceBeforeWithdraw = await crv3.balanceOf(crv3Holder._address);
    //     const tx = await (await crv3Vault.connect(crv3Holder).withdraw(amountToWithdraw)).wait();
    //     const crv3BalanceAfterWithdraw = await crv3.balanceOf(crv3Holder._address);
    //     const crv3GaugeStakedAfterWithdraw = await crv3LG.balanceOf(locker.address);
    //     const fee = amountToWithdraw.mul(50).div(10000);
    //     // expect(crv3BalanceAfterWithdraw.sub(sanUsdcEurBalanceBeforeWithdraw)).to.be.equal(
    //     //     amountToWithdraw.sub(fee)
    //     // );
    //     // expect(crv3GaugeStakedAfterWithdraw).to.be.equal(parseEther("501"));
    // });

    // it("should be able to claim rewards when some time pass", async () => {
    //     const amountToDeposit = parseEther("1000")
    //     await gc.connect(crv3Holder).vote_for_gauge_weights(crv3MultiGauge.address, 10000);
    //     await crv3.connect(crv3Holder).approve(crv3Vault.address, amountToDeposit);
    //     await crv3Vault.connect(crv3Holder).deposit(crv3Holder._address, amountToDeposit, true);
    //     await sdtDProxy.connect(deployer_new).approveGauge(crv3MultiGauge.address);
    //     // increase the timestamp by 1 month
    //     await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
    //     await network.provider.send("evm_mine", []);
    //     await gc.connect(crv3Holder).checkpoint_gauge(crv3MultiGauge.address);

    //     const multiGaugeRewardRateBefore = await crv3MultiGauge.reward_data(crv.address);
    //     const msCrvBalanceBefore = await crv.balanceOf(dummyMs.address);
    //     const accumulatorCrvBalanceBefore = await crv.balanceOf(CRV_ACCUMULATOR);
    //     //const claimable = await crv3LiqudityGauge.claimable_reward(locker.address, crv.address);
    //     const gaugeType = await strategy.lGaugeType(crv3LG.address);
    //     //console.log(gaugeType);
    //     const tx = await (await strategy.claim(crv3.address)).wait();
    //     // const crvGRWA = await gc["gauge_relative_weight(address)"](crv3MultiGauge.address);
    //     // const accumulatorCrvBalanceAfter = await crv.balanceOf(CRV_ACCUMULATOR);
    //     // const multiGaugeRewardRateAfter = await crv3MultiGauge.reward_data(crv.address);
    //     // const sdtRewardsAfter = await crv3MultiGauge.reward_data(SDT);
    //     // const msCrvBalanceAfter = await crv.balanceOf(dummyMs.address);
    //     // //const perfFee = claimable.mul(BigNumber.from(200)).div(BigNumber.from(10000));
    //     // //const accumulatorPart = claimable.mul(BigNumber.from(800)).div(BigNumber.from(10000));
    //     // //const claimed = tx.events.find((e: any) => e.event === "Claimed");
    //     // const sdtBalance = await sdt.balanceOf(crv3MultiGauge.address);
    //     // const sdtBalanceOfDistributor = await sdt.balanceOf(sdtDProxy.address);
    //     //expect(claimed.args[2]).to.be.equal(claimable);
    //     // expect(multiGaugeRewardRateBefore[3]).to.be.equal(0);
    //     // expect(multiGaugeRewardRateAfter[3]).to.be.gt(0);
    //     // expect(sdtRewardsAfter[3]).to.be.gt(0);
    //     //expect(perfFee).to.be.gt(0);
    //     //expect(accumulatorPart).to.be.gt(0);
    //     //expect(msCrvBalanceAfter.sub(msCrvBalanceBefore)).to.be.equal(perfFee);
    //     //expect(accumulatorCrvBalanceAfter.sub(accumulatorCrvBalanceBefore)).to.be.equal(accumulatorPart);
    //     //expect(crvGRWA).to.be.eq(parseEther("1")); // 100%   
    // }).timeout(0);

    // it("it should claim 3crv weekly reward", async () => {
    //   // Claim weekly 3crv reward for the CRV Locker 
    //   const crv3BalanceBeforeInLG = await crv3.balanceOf(SD_CRV_LG);
    //   await strategy.claim3Crv(true);
    //   const crv3BalanceAfterInLG = await crv3.balanceOf(SD_CRV_LG);
    //   expect(crv3BalanceAfterInLG).gt(crv3BalanceBeforeInLG);
    // });

    // it("it should get maximum boost from curve liquidity gauge", async () => {
    //   const workingBalance = await crv3LG.working_balances(locker.address);
    //   const stakedAmount = await crv3LG.balanceOf(locker.address);
    //   const boost = workingBalance.mul(BigNumber.from(10).pow(18)).div(stakedAmount.mul(4).div(10));
    //   expect(boost).to.be.eq(parseEther("2.5"));
    // });

    // it("it should be able swap crv and transfer to feeDistributor from veSDTFeeCrvProxy", async () => {
    //   const fraxBalanceOfClaimer = await frax.balanceOf(localDeployer.address);
    //   const sd3CrvBalanceOfFeeD = await sdFrax3Crv.balanceOf(STAKEDAO_FEE_DISTRIBUTOR);
    //   const crvProxyBalanceBefore = await crv.balanceOf(VeSdtProxy.address);
    //   expect(crvProxyBalanceBefore).gt(0);
    //   await VeSdtProxy.sendRewards();
    //   const crvProxyBalanceAfter = await crv.balanceOf(VeSdtProxy.address);
    //   expect(crvProxyBalanceAfter).eq(0);
    // });
    
    // it("it should accumulated angle rewards to sdAngle liquidity gauge from AngleAccumulator", async () => {
    //   const gaugeAngleBalanceBefore = await crv.balanceOf(sdCrvGauge.address);
    //   await sdCrvGauge.connect(deployer).add_reward(crv.address, crvAccumulator.address);
    //   await crvAccumulator.connect(deployer).notifyAllExtraReward(crv.address);
    //   const gaugeCrvBalanceAfter = await crv.balanceOf(sdCrvGauge.address);
    //   const curveAccumulatorBalance = await crv.balanceOf(crvAccumulator.address);
    //   expect(gaugeCrvBalanceAfter.sub(gaugeAngleBalanceBefore)).to.be.gt(0);
    //   expect(curveAccumulatorBalance).to.be.equal(0);
    // });

    // it("it should create new vault and multigauge rewards for different Curve LP token", async () => {
    //   const cloneTx = await (await curveVaultFactoryContract.cloneAndInit(EUR3_GAUGE)).wait();
    //   eur3Vault = await ethers.getContractAt("AngleVault", cloneTx.events[0].args[0]);

    //   const gauge = cloneTx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];

    //   eur3MultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge);
    //   eur3LG = await ethers.getContractAt("LiquidityGaugeV4", EUR3_GAUGE);
    //   const tokenOfVault = await eur3Vault.token();
    //   // add 3Eur gauge to gaugecontroller
    //   await gc.connect(deployer_new)["add_gauge(address,int128,uint256)"](eur3MultiGauge.address, 0, 0); // gauge - type - weight
    //   await sdtDProxy.connect(deployer_new).approveGauge(eur3MultiGauge.address);
    //   expect(tokenOfVault.toLowerCase()).to.be.equal(EUR3.toLowerCase());
    // });

    // it("it should be able to deposit 3Eur LPs to new vault", async () => {
    //   const amountToDeposit = parseEther("100");
    //   const gaugeTokenBalanceBeforeDeposit = await eur3MultiGauge.balanceOf(eur3Holder._address);
    //   await eur3.connect(eur3Holder).approve(eur3Vault.address, ethers.constants.MaxUint256);
    //   // await eur3Vault.connect(eur3Holder).deposit(eur3Holder._address, amountToDeposit, false);
    //   // const gaugeTokenBalanceAfterDeposit = await eur3MultiGauge.balanceOf(eur3Holder._address);
    //   // expect(gaugeTokenBalanceBeforeDeposit).to.be.equal(0);
    //   // expect(gaugeTokenBalanceAfterDeposit.sub(gaugeTokenBalanceBeforeDeposit)).to.be.equal(parseEther("9990"));
    // });

    // steCrv
    // it("it should be able to clone a new vault", async () => {
    //   const cloneTx = await (await curveVaultFactoryContract.cloneAndInit(STECRV_GAUGE)).wait();
    //   const gaugeSteCrv= cloneTx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    //   steCrvVault = await ethers.getContractAt("CurveVault", cloneTx.events[0].args[0]);
    //   steCrvMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gaugeSteCrv);
    //   const tokenOfVault = await steCrvVault.token();
    //   steCrvLG = await ethers.getContractAt("LiquidityGaugeV4", STECRV_GAUGE);

    //   // add it to GC
    //   await gc.connect(deployer_new)["add_gauge(address,int128,uint256)"](steCrvMultiGauge.address, 0, 0);
    //   await sdtDProxy.connect(deployer_new).approveGauge(steCrvMultiGauge.address);

    //   expect(tokenOfVault.toLowerCase()).to.be.equal(STECRV.toLowerCase());
    // });

    it("it should act a soft migration", async () => {
    });

    it("it should act an hard migration", async () => {
    });
  });
});
