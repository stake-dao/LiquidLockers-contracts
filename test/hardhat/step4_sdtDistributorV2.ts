import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import ERC20ABI from "./fixtures/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";
import AngleLockerABI from "./fixtures/AngleLocker.json";
import {
  SDT,
  FRAX,
  WETH,
  ANGLE,
  VE_SDT,
  TIMELOCK,
  MASTERCHEF,
  STDDEPLOYER,
  ANGLE_LOCKER,
  VESDT_HOLDER,
  sanDAI_EUR_GAUGE,
  ANGLEACCUMULATOR,
  sanUSDC_EUR_GAUGE,
  SAN_DAI_EUR_HOLDER,
  SAN_USDC_EUR_HOLDER,
} from "./constant";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

describe("SDTDistributor V2 using Angle Gauges", function () {
  let snapshotId: any;
  let pidSdtD: number;

  let deployer: JsonRpcSigner;
  let timelock: JsonRpcSigner;
  let veSdtHolder: JsonRpcSigner;

  let dummyMs: SignerWithAddress;

  let gc: Contract;
  let sdt: Contract;
  let locker: Contract;
  let strategy: Contract;
  let sdtDProxy: Contract;
  let masterchef: Contract;
  let VeSdtProxy: Contract;
  let sdtDistributor: Contract;
  let sanDaiEurMultiGauge: Contract;
  let sanUSDCEurMultiGauge: Contract;
  let angleVaultFactoryContract: Contract;

  before(async function () {

    [dummyMs] = await ethers.getSigners();

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

    const AngleStrategy = await ethers.getContractFactory("AngleStrategy");
    const SdtDistributor = await ethers.getContractFactory("SdtDistributorV2");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");

    deployer = ethers.provider.getSigner(STDDEPLOYER);
    timelock = await ethers.provider.getSigner(TIMELOCK);
    veSdtHolder = await ethers.provider.getSigner(VESDT_HOLDER);

    await network.provider.send("hardhat_setBalance", [SAN_USDC_EUR_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [SAN_DAI_EUR_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [VESDT_HOLDER, ETH_100]);
    await network.provider.send("hardhat_setBalance", [timelock._address, parseEther("10").toHexString()]);

    locker = await ethers.getContractAt(AngleLockerABI, ANGLE_LOCKER);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);

    const veSdtAngleProxyFactory = await ethers.getContractFactory("veSDTFeeAngleProxy");

    VeSdtProxy = await veSdtAngleProxyFactory.deploy([ANGLE, WETH, FRAX]);
    const proxyAdmin = await ProxyAdmin.deploy();

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

    const liquidityGaugeFactory = await ethers.getContractFactory("LiquidityGaugeV4Strat");
    const liquidityGaugeStratImp = await liquidityGaugeFactory.deploy();
    const angleVaultFactory = await ethers.getContractFactory("AngleVaultFactory");

    angleVaultFactoryContract = await angleVaultFactory.deploy(
      liquidityGaugeStratImp.address,
      strategy.address,
      sdtDProxy.address
    );
    await strategy.connect(deployer).setVaultGaugeFactory(angleVaultFactoryContract.address);

    let cloneTx = await (await angleVaultFactoryContract.cloneAndInit(sanUSDC_EUR_GAUGE)).wait();
    let gauge = cloneTx.events.filter((e: { event: string; }) => e.event == "GaugeDeployed")[0].args[0]

    sanUSDCEurMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge);

    cloneTx = await (await angleVaultFactoryContract.cloneAndInit(sanDAI_EUR_GAUGE)).wait();
    gauge = cloneTx.events.filter((e: { event: string; }) => e.event == "GaugeDeployed")[0].args[0]

    sanDaiEurMultiGauge = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge);

    // Add Gauge Types
    const typesWeight = parseEther("1");
    await gc.connect(deployer)["add_type(string,uint256)"]("Mainnet staking", typesWeight); // 0
    await gc.connect(deployer)["add_type(string,uint256)"]("External", typesWeight); // 1
    await gc.connect(deployer)["add_type(string,uint256)"]("Cross Chain", typesWeight); // 2

    // Add gauges to GaugeController.
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](sanUSDCEurMultiGauge.address, 0, 0); // gauge - type - weight
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](sanDaiEurMultiGauge.address, 0, 0); // gauge - type - weight

    /** Masterchef <> SdtDistributor setup */
    const masterToken = await sdtDProxy.masterchefToken();
    await masterchef.connect(timelock).add(1000, masterToken, false);
    const poolsLength = await masterchef.poolLength();
    pidSdtD = poolsLength - 1;
    await sdtDProxy.connect(deployer).initializeMasterchef(pidSdtD);
    await sdtDProxy.connect(deployer).setDistribution(true);
  });

  describe("SDTDistributor", function () {
    beforeEach(async function () {
      snapshotId = await ethers.provider.send('evm_snapshot', []);
    });

    afterEach(async function () {
      await ethers.provider.send('evm_revert', [snapshotId]);
    })

    it("should distribute to single gauge", async () => {
      // Attribute full weight to a gauge
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanUSDCEurMultiGauge.address, 10000);
      await sdtDProxy.connect(deployer).approveGauge(sanUSDCEurMultiGauge.address);

      // increase the timestamp by 8 days
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 8]);
      await network.provider.send("evm_mine", []);

      const lastBlock = await ethers.provider.getBlock("latest")
      // Rounded down to day
      const currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)

      const before_DistributorBalance = await sdt.balanceOf(sanUSDCEurMultiGauge.address);
      await sdtDProxy.connect(deployer).distribute(sanUSDCEurMultiGauge.address);
      const after_DistributorBalance = await sdt.balanceOf(sanUSDCEurMultiGauge.address);

      const lastPull = await sdtDProxy.pulls(currentTimestamp)

      const expectedDistribution = after_DistributorBalance - before_DistributorBalance;
      expect(Number(lastPull)).to.be.equal(expectedDistribution);
    });

    it("should distribute to gauges if days past 40", async () => {
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanUSDCEurMultiGauge.address, 5000);
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanDaiEurMultiGauge.address, 5000);

      await sdtDProxy.connect(deployer).approveGauge(sanUSDCEurMultiGauge.address);
      await sdtDProxy.connect(deployer).approveGauge(sanDaiEurMultiGauge.address);

      const before_DistributorBalance_1 = await sdt.balanceOf(sanUSDCEurMultiGauge.address);
      const before_DistributorBalance_2 = await sdt.balanceOf(sanDaiEurMultiGauge.address);

      // increase the timestamp by 8 days
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 8]);
      await network.provider.send("evm_mine", []);

      await sdtDProxy.connect(deployer).distribute(sanUSDCEurMultiGauge.address);

      let lastBlock = await ethers.provider.getBlock("latest")
      // Rounded down to day
      let currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)
      const firstPull = await sdtDProxy.pulls(currentTimestamp)

      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 32]);
      await network.provider.send("evm_mine", []);

      await sdtDProxy.connect(deployer).distribute(sanDaiEurMultiGauge.address);

      lastBlock = await ethers.provider.getBlock("latest")
      // Rounded down to day
      currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)
      const secondPull = await sdtDProxy.pulls(currentTimestamp)

      const after_DistributorBalance_1 = await sdt.balanceOf(sanUSDCEurMultiGauge.address);
      const after_DistributorBalance_2 = await sdt.balanceOf(sanDaiEurMultiGauge.address);

      const expectedDistribution_1 = after_DistributorBalance_1 - before_DistributorBalance_1;
      const expectedDistribution_2 = after_DistributorBalance_2 - before_DistributorBalance_2;

      expect(Number(firstPull) / 2).to.be.equal(expectedDistribution_1);
      expect((Number(firstPull) + Number(secondPull)) / 2).to.be.equal(expectedDistribution_2);
      // TODO
    });

    it("should distribute to gauges when days past 46 with leftover", async () => {
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanUSDCEurMultiGauge.address, 5000);
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanDaiEurMultiGauge.address, 5000);

      await sdtDProxy.connect(deployer).approveGauge(sanUSDCEurMultiGauge.address);
      await sdtDProxy.connect(deployer).approveGauge(sanDaiEurMultiGauge.address);

      const before_DistributorBalance_1 = await sdt.balanceOf(sanUSDCEurMultiGauge.address);
      const before_DistributorBalance_2 = await sdt.balanceOf(sanDaiEurMultiGauge.address);

      // increase the timestamp by 8 days
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 8]);
      await network.provider.send("evm_mine", []);

      await sdtDProxy.connect(deployer).distribute(sanUSDCEurMultiGauge.address);

      let lastBlock = await ethers.provider.getBlock("latest")
      // Rounded down to day
      let currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)
      const firstPull = await sdtDProxy.pulls(currentTimestamp)

      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 38]);
      await network.provider.send("evm_mine", []);

      await sdtDProxy.connect(deployer).distribute(sanDaiEurMultiGauge.address);

      lastBlock = await ethers.provider.getBlock("latest")
      // Rounded down to day
      currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)
      const secondPull = await sdtDProxy.pulls(currentTimestamp)

      const after_DistributorBalance_1 = await sdt.balanceOf(sanUSDCEurMultiGauge.address);
      const after_DistributorBalance_2 = await sdt.balanceOf(sanDaiEurMultiGauge.address);

      const expectedDistribution_1 = after_DistributorBalance_1 - before_DistributorBalance_1;
      const expectedDistribution_2 = after_DistributorBalance_2 - before_DistributorBalance_2;

      const leftover = await sdt.balanceOf(sdtDProxy.address);

      expect(Number(firstPull) / 2).to.be.equal(expectedDistribution_1);
      expect(Number(firstPull) / 2 + (Number(secondPull)) / 2).to.be.equal(expectedDistribution_2);
      expect(Number(leftover)).to.be.equal(Number(secondPull) / 2);
    });

    it("should not distribute to gauge with weight 0", async () => {
      await sdtDProxy.connect(deployer).approveGauge(sanUSDCEurMultiGauge.address);

      const before_DistributorBalance = await sdt.balanceOf(sanUSDCEurMultiGauge.address);

      // increase the timestamp by 8 days
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 8]);
      await network.provider.send("evm_mine", []);

      await sdtDProxy.connect(deployer).distribute(sanUSDCEurMultiGauge.address);

      let lastBlock = await ethers.provider.getBlock("latest")
      // Rounded down to day
      let currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)

      lastBlock = await ethers.provider.getBlock("latest")
      // Rounded down to day
      currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)
      const after_DistributorBalance = await sdt.balanceOf(sanUSDCEurMultiGauge.address);
      const expectedDistribution = after_DistributorBalance - before_DistributorBalance;

      // distribute should have checkpointed
      const weight = await gc["gauge_relative_weight(address)"](sanUSDCEurMultiGauge.address);

      expect(weight).to.be.equal(0);
      expect(expectedDistribution).to.be.equal(0);
    });

    it("should distribute to multiple gauges", async () => {
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanUSDCEurMultiGauge.address, 5000);
      await gc.connect(veSdtHolder).vote_for_gauge_weights(sanDaiEurMultiGauge.address, 5000);

      await sdtDProxy.connect(deployer).approveGauge(sanUSDCEurMultiGauge.address);
      await sdtDProxy.connect(deployer).approveGauge(sanDaiEurMultiGauge.address);

      const before_DistributorBalance_1 = await sdt.balanceOf(sanUSDCEurMultiGauge.address);
      const before_DistributorBalance_2 = await sdt.balanceOf(sanDaiEurMultiGauge.address);

      // increase the timestamp by 8 days
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 8]);
      await network.provider.send("evm_mine", []);

      await sdtDProxy.connect(deployer).distributeMulti([sanUSDCEurMultiGauge.address, sanDaiEurMultiGauge.address]);

      let lastBlock = await ethers.provider.getBlock("latest")
      // Rounded down to day
      let currentTimestamp = lastBlock.timestamp - (lastBlock.timestamp % 86_400)
      const firstPull = await sdtDProxy.pulls(currentTimestamp)

      const after_DistributorBalance_1 = await sdt.balanceOf(sanUSDCEurMultiGauge.address);
      const after_DistributorBalance_2 = await sdt.balanceOf(sanDaiEurMultiGauge.address);

      const expectedDistribution_1 = after_DistributorBalance_1 - before_DistributorBalance_1;
      const expectedDistribution_2 = after_DistributorBalance_2 - before_DistributorBalance_2;

      expect(Number(firstPull) / 2).to.be.equal(expectedDistribution_1);
      expect(Number(firstPull) / 2).to.be.equal(expectedDistribution_2);
    });
  });
});
