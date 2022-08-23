import { skip } from "./utils";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { parseEther } from "@ethersproject/units";
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import ERC20ABI from "./fixtures/ERC20.json";
import GaugeControllerABI from "./fixtures/GaugeController.json";
import BalancerFeeDistributorABI from "./fixtures/BalancerFeeDistributor.json";
import MasterchefABI from "./fixtures/Masterchef.json";

import {
  BAL,
  BALANCER_LOCKER,
  REWARD,
  SDT,
  STDDEPLOYER,
  HOLDER,
  BALANCER_FEE_DISTRIBUTOR,
  MASTERCHEF,
  ZERO_ADDRESS
} from "./constant";
import { assert } from "console";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const BALANCER_LOCKER_GOV = "0x873b031ea6e4236e44d933aae5a66af6d4da419d";
const SDBAL_GAUGE_ADMIN = "0x0de5199779b43e13b3bec21e91117e18736bc1a8";
const SDBAL_GAUGE = "0x3E8C72655e48591d93e6dfdA16823dB0fF23d859";
const BALANCER_GAUGE_CONTROLLER = "0x75f8f7fa4b6DA6De9F4fE972c811b778cefce882";
const SDT_DISTRIBUTOR_V2 = "0x8Dc551B4f5203b51b5366578F42060666D42AB5E";

describe("Balancer DepositorV2", function () {
  let nooby: SignerWithAddress;

  let deployer: JsonRpcSigner;
  let lockerGovernance: JsonRpcSigner;
  let sdBalGaugeAdmin: JsonRpcSigner;
  let holder: JsonRpcSigner;

  let bal: Contract;
  let sdt: Contract;
  let bonus: Contract;
  let sdBalGauge: Contract;
  let accumulator: Contract;
  let locker: Contract;
  let feeDistributor: Contract;
  let sdtDistributor: Contract;
  let masterchef: Contract;
  let gaugeController: Contract;

  before(async function () {
    [nooby] = await ethers.getSigners();

    // Impersonate SDT Deployer
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });
    await network.provider.send("hardhat_setBalance", [STDDEPLOYER, ETH_100]);
    deployer = ethers.provider.getSigner(STDDEPLOYER);

    // Impersonate Balancer Locker Governance
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BALANCER_LOCKER_GOV]
    });
    await network.provider.send("hardhat_setBalance", [BALANCER_LOCKER_GOV, ETH_100]);
    lockerGovernance = ethers.provider.getSigner(BALANCER_LOCKER_GOV);

    // Impersonate Bonus and Bal Holder
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [HOLDER]
    });
    await network.provider.send("hardhat_setBalance", [HOLDER, ETH_100]);
    holder = ethers.provider.getSigner(HOLDER);

    // Impersonate SDBall Gauge Admin
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDBAL_GAUGE_ADMIN]
    });
    await network.provider.send("hardhat_setBalance", [SDBAL_GAUGE_ADMIN, ETH_100]);
    sdBalGaugeAdmin = ethers.provider.getSigner(SDBAL_GAUGE_ADMIN);

    const accumulatorContract = await ethers.getContractFactory("BalancerAccumulatorV2");

    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    bal = await ethers.getContractAt(ERC20ABI, BAL);
    (bonus = await ethers.getContractAt(ERC20ABI, REWARD)),
      (sdBalGauge = await ethers.getContractAt("LiquidityGaugeV4", SDBAL_GAUGE));
    locker = await ethers.getContractAt("BalancerLocker", BALANCER_LOCKER);
    sdtDistributor = await ethers.getContractAt("SdtDistributorV2", SDT_DISTRIBUTOR_V2);
    feeDistributor = await ethers.getContractAt(BalancerFeeDistributorABI, BALANCER_FEE_DISTRIBUTOR);
    masterchef = await ethers.getContractAt(MasterchefABI, MASTERCHEF);
    gaugeController = await ethers.getContractAt(GaugeControllerABI, BALANCER_GAUGE_CONTROLLER);

    // deployed with address null for LV4 for test, but setup after correctly
    accumulator = await accumulatorContract.connect(deployer).deploy(BAL, ZERO_ADDRESS);
    //accumulator = await accumulatorContract.connect(deployer).deploy(BAL,SDBAL_GAUGE);

    await accumulator.connect(deployer).setTokenRewards([BAL, REWARD]);
    await bal.connect(holder).transfer(BALANCER_FEE_DISTRIBUTOR, parseEther("20"));
    await bonus.connect(holder).transfer(BALANCER_FEE_DISTRIBUTOR, parseEther("10"));
    await sdBalGauge.connect(sdBalGaugeAdmin).set_reward_distributor(BAL, accumulator.address);
    await sdBalGauge.connect(sdBalGaugeAdmin).set_reward_distributor(REWARD, accumulator.address);
  });

  describe("Testing AccumulatorV2", function () {
    it("Should revert because locker is not set up on the accumulator", async function () {
      await expect(accumulator.connect(nooby).claimAllRewardsAndNotify()).to.be.revertedWith("locker not set");
      await accumulator.connect(deployer).setLocker(BALANCER_LOCKER);

      expect(await accumulator.locker()).eq(BALANCER_LOCKER);
    });

    it("Should revert because accumulator is not set up on the locker", async function () {
      await expect(accumulator.connect(deployer).claimAllRewardsAndNotify()).to.be.revertedWith("!(gov||acc)");
      await locker.connect(lockerGovernance).setAccumulator(accumulator.address);

      expect(await locker.accumulator()).eq(accumulator.address);
    });

    it("Should revert because gauge is set to ZERO_ADDRESS", async function () {
      await expect(accumulator.connect(deployer).claimAllRewardsAndNotify()).to.be.revertedWith("gauge not set");
      await accumulator.connect(deployer).setGauge(SDBAL_GAUGE);

      expect(await accumulator.gauge()).eq(SDBAL_GAUGE);
    });

    it("Should send 0 to the claimer, because claimer fee == 0 and 0 SDT because distributor == address(0)", async function () {
      const BALBalanceNoobyBefore = await bal.balanceOf(nooby.address);
      const BALBalanceGaugeBefore = await bal.balanceOf(SDBAL_GAUGE);
      const BONBalanceNoobyBefore = await bonus.balanceOf(nooby.address);
      const BONBalanceGaugeBefore = await bonus.balanceOf(SDBAL_GAUGE);
      const SDTBalanceGaugeBefore = await sdt.balanceOf(SDBAL_GAUGE);

      await feeDistributor.checkpoint();
      await feeDistributor.checkpointUser(locker.address);
      skip(86_401 * 7);
      await feeDistributor.checkpoint();
      await feeDistributor.checkpointUser(locker.address);
      skip(86_401 * 7);
      await feeDistributor.checkpoint();
      await feeDistributor.checkpointUser(locker.address);

      const distrib = await accumulator.sdtDistributor();
      const isKilled = await sdtDistributor.killedGauges(SDBAL_GAUGE);
      const gaugetype = await gaugeController.gauge_types(SDBAL_GAUGE);
      const time = await getNow();
      const lastMasterchefPull = await sdtDistributor.lastMasterchefPull();
      assert(gaugetype == 0);
      assert(distrib == ZERO_ADDRESS);
      assert(isKilled == false);
      assert(time > Number(lastMasterchefPull) + 86400);

      const claim = await accumulator.connect(nooby).claimAllRewardsAndNotify();
      const receipt = await claim.wait();
      //console.log(receipt.events)

      const BALBalanceNoobyAfter = await bal.balanceOf(nooby.address);
      const BALBalanceGaugeAfter = await bal.balanceOf(SDBAL_GAUGE);
      const BONBalanceNoobyAfter = await bonus.balanceOf(nooby.address);
      const BONBalanceGaugeAfter = await bonus.balanceOf(SDBAL_GAUGE);
      const SDTBalanceGaugeAfter = await sdt.balanceOf(SDBAL_GAUGE);

      //console.log((SDTBalanceGaugeAfter-SDTBalanceGaugeBefore).toString())
      //console.log((BALBalanceNoobyAfter-BALBalanceNoobyBefore).toString())
      //console.log((BONBalanceNoobyAfter-BONBalanceNoobyBefore).toString())
      //console.log((BALBalanceGaugeAfter-BALBalanceGaugeBefore).toString())
      //console.log((BONBalanceGaugeAfter-BONBalanceGaugeBefore).toString())

      expect(BALBalanceNoobyAfter - BALBalanceNoobyBefore).eq(0);
      expect(BALBalanceGaugeAfter - BALBalanceGaugeBefore).gt(0);
      expect(BONBalanceNoobyAfter - BONBalanceNoobyBefore).eq(0);
      expect(BONBalanceGaugeAfter - BONBalanceGaugeBefore).gt(0);
      expect(SDTBalanceGaugeAfter - SDTBalanceGaugeBefore).eq(0);
    });

    it("Should revert set distributor, because not owner and because address(null)", async function () {
      await expect(accumulator.connect(nooby).setSdtDistributor(SDT_DISTRIBUTOR_V2)).to.be.revertedWith("!gov");
      await expect(accumulator.connect(deployer).setSdtDistributor(ZERO_ADDRESS)).to.be.revertedWith(
        "can't be zero address"
      );

      await accumulator.connect(deployer).setSdtDistributor(SDT_DISTRIBUTOR_V2);
      expect(await accumulator.sdtDistributor()).eq(SDT_DISTRIBUTOR_V2);
    });

    it("Should revert to set claimer fee, because not owner", async function () {
      await expect(accumulator.connect(nooby).setClaimerFee(1000)).to.be.revertedWith("!gov");

      await accumulator.connect(deployer).setClaimerFee(1000);
      expect(await accumulator.claimerFee()).eq(1000);
    });

    it("Should revert because distributor is not set for BAL on LV4", async function () {
      await sdBalGauge.connect(sdBalGaugeAdmin).set_reward_distributor(BAL, nooby.address);

      await feeDistributor.checkpoint();
      await feeDistributor.checkpointUser(locker.address);
      skip(86_401 * 7);
      await feeDistributor.checkpoint();
      await feeDistributor.checkpointUser(locker.address);
      skip(86_401 * 7);
      await feeDistributor.checkpoint();
      await feeDistributor.checkpointUser(locker.address);

      // revert because [BAL].distributor on LV4 is not set to the accumulator
      await expect(accumulator.connect(nooby).claimAllRewardsAndNotify()).to.be.reverted;

      await sdBalGauge.connect(sdBalGaugeAdmin).set_reward_distributor(BAL, accumulator.address);
      expect((await sdBalGauge.reward_data(BAL))["distributor"]).eq(accumulator.address);
    });

    it("Should distribute reward (BAL, BONUS, SDT) to claimer and LV4", async function () {
      const BALBalanceNoobyBefore = await bal.balanceOf(nooby.address);
      const BALBalanceGaugeBefore = await bal.balanceOf(SDBAL_GAUGE);
      const BONBalanceNoobyBefore = await bonus.balanceOf(nooby.address);
      const BONBalanceGaugeBefore = await bonus.balanceOf(SDBAL_GAUGE);
      const SDTBalanceGaugeBefore = await sdt.balanceOf(SDBAL_GAUGE);

      await feeDistributor.checkpoint();
      await feeDistributor.checkpointUser(locker.address);
      skip(86_401 * 7);
      await feeDistributor.checkpoint();
      await feeDistributor.checkpointUser(locker.address);
      skip(86_401 * 7);
      await feeDistributor.checkpoint();
      await feeDistributor.checkpointUser(locker.address);

      const distrib = await accumulator.sdtDistributor();
      const isKilled = await sdtDistributor.killedGauges(SDBAL_GAUGE);
      const gaugetype = await gaugeController.gauge_types(SDBAL_GAUGE);
      const time = await getNow();
      const lastMasterchefPull = await sdtDistributor.lastMasterchefPull();
      assert(gaugetype == 0);
      assert(distrib != ZERO_ADDRESS);
      assert(isKilled == false);
      assert(time > Number(lastMasterchefPull) + 86400);

      const claim = await accumulator.connect(nooby).claimAllRewardsAndNotify();
      const receipt = await claim.wait();
      //console.log(receipt.events)

      const BALBalanceNoobyAfter = await bal.balanceOf(nooby.address);
      const BALBalanceGaugeAfter = await bal.balanceOf(SDBAL_GAUGE);
      const BONBalanceNoobyAfter = await bonus.balanceOf(nooby.address);
      const BONBalanceGaugeAfter = await bonus.balanceOf(SDBAL_GAUGE);
      const SDTBalanceGaugeAfter = await sdt.balanceOf(SDBAL_GAUGE);

      //console.log((SDTBalanceGaugeAfter-SDTBalanceGaugeBefore).toString())
      //console.log((BALBalanceNoobyAfter-BALBalanceNoobyBefore).toString())
      //console.log((BONBalanceNoobyAfter-BONBalanceNoobyBefore).toString())
      //console.log((BALBalanceGaugeAfter-BALBalanceGaugeBefore).toString())
      //console.log((BONBalanceGaugeAfter-BONBalanceGaugeBefore).toString())

      expect(BALBalanceNoobyAfter - BALBalanceNoobyBefore).gt(0);
      expect(BALBalanceGaugeAfter - BALBalanceGaugeBefore).gt(0);
      expect(BONBalanceNoobyAfter - BONBalanceNoobyBefore).gt(0);
      expect(BONBalanceGaugeAfter - BONBalanceGaugeBefore).gt(0);
      expect(SDTBalanceGaugeAfter - SDTBalanceGaugeBefore).gt(0);
    });
  });

  const getNow = async function () {
    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);
    var time = block.timestamp;
    return time;
  };
});
