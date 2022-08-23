import { ethers, network } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";

const SDTWHALE = "0x48238Faf05BF8B745249dB3c26606A72149600B8";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VESDTP = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";

const sdFXS = "0x402F878BDd1f5C66FdAF0fabaBcF74741B68ac36"; // sdFXS
const sdANGLE = "0x752B4c6e92d96467fE9b9a2522EF07228E00F87c"; // sdANGLE

const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const SAN_USDC_EUR = "0x9C215206Da4bf108aE5aEEf9dA7caD3352A36Dad";

const FXS_LOCKER = "0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f";
const ANGLE_LOCKER = "0xD13F8C25CceD32cdfA79EB5eD654Ce3e484dCAF5";

const MASTERCHEF = "0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c";
const SWW = "0x37E8386602d9EBEa2c56dd11d8E142290595f1b5"; // SmartWalletWhitelist

const TIMELOCK = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";

const sdFXSWHALE = "0xbd2471b4150619a42093ffba3a7af35335cec5b6";
const sdANGLEWHALE = "0xb36a0671b3d49587236d7833b01e79798175875f";

const DUMMYUSER = "0xf9E58B35310430C7894742000cF670062CADeF70";
const DUMMYUSER2 = "0x80d9BC4B2B21C69ba2B7ED92882fF79069Ea7e13";
const DUMMYUSER3 = "0x81431b69B1e0E334d4161A13C2955e0f3599381e";

const SDT_DEPLOYER = "0xb36a0671B3D49587236d7833B01E79798175875f";

const FAKE_INTERFACE_KNOWN = "0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616";

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("Sdt Distributor - SDT distribution related tests", () => {
  let sdt: Contract;
  let sdfxs: Contract;
  let sdangle: Contract;
  let veSDTProxy: Contract;
  let gc: Contract;
  let lgv4FXSLogic: Contract;
  let fxsPPSGaugeProxy: Contract;
  let lgv4ANGLELogic: Contract;
  let anglePPSGaugeProxy: Contract;
  let proxyAdmin: Contract;
  let sww: Contract;
  let sdtDistributor: Contract;
  let sdtDProxy: Contract;
  //let veBoost: Contract;
  let veBoostProxy: Contract;
  let masterchef: Contract;
  let fxsAccumulator: Contract;
  let angleAccumulator: Contract;
  let fxsLocker: Contract;
  let angleLocker: Contract;
  let fxs: Contract;
  let sanUsdcEur: Contract;
  let timelock: JsonRpcSigner;
  let sdtWhaleSigner: JsonRpcSigner;
  let sdFXSWhaleSigner: JsonRpcSigner;
  let sdAngleWhaleSigner: JsonRpcSigner;
  let sdtDeployerSigner: JsonRpcSigner;
  let deployer: SignerWithAddress;
  let dummyUser: JsonRpcSigner;
  let dummyUser2: JsonRpcSigner;
  let dummyUser3: JsonRpcSigner;
  let pidSdtD: number;

  before(async function () {
    this.enableTimeouts(false);

    // await network.provider.request({
    //   method: "hardhat_reset",
    //   params: [
    //     {
    //       forking: {
    //         jsonRpcUrl: process.env.MAINNET,
    //         blockNumber: 14133625
    //       }
    //     }
    //   ]
    // });
    [deployer] = await ethers.getSigners();

    sdt = await ethers.getContractAt(ERC20, SDT);
    sdfxs = await ethers.getContractAt(ERC20, sdFXS);
    sdangle = await ethers.getContractAt(ERC20, sdANGLE);
    sww = await ethers.getContractAt("SmartWalletWhitelist", SWW);
    veSDTProxy = await ethers.getContractAt("veSDT", VESDTP);
    masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);
    fxsLocker = await ethers.getContractAt("FxsLocker", FXS_LOCKER);
    angleLocker = await ethers.getContractAt("AngleLocker", ANGLE_LOCKER);
    fxs = await ethers.getContractAt(ERC20, FXS);
    sanUsdcEur = await ethers.getContractAt(ERC20, SAN_USDC_EUR);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDTWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [sdFXSWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [sdANGLEWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [TIMELOCK]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DUMMYUSER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DUMMYUSER2]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DUMMYUSER3]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDT_DEPLOYER]
    });

    await deployer.sendTransaction({
      to: DUMMYUSER,
      value: ethers.utils.parseEther("100") // 1 ether
    });

    await deployer.sendTransaction({
      to: DUMMYUSER2,
      value: ethers.utils.parseEther("100") // 1 ether
    });
    await deployer.sendTransaction({
      to: DUMMYUSER3,
      value: ethers.utils.parseEther("100") // 1 ether
    });

    sdtWhaleSigner = await ethers.provider.getSigner(SDTWHALE);
    sdFXSWhaleSigner = await ethers.provider.getSigner(sdFXSWHALE);
    sdAngleWhaleSigner = await ethers.provider.getSigner(sdANGLEWHALE);
    timelock = await ethers.provider.getSigner(TIMELOCK);
    dummyUser = await ethers.provider.getSigner(DUMMYUSER);
    dummyUser2 = await ethers.provider.getSigner(DUMMYUSER2);
    dummyUser3 = await ethers.provider.getSigner(DUMMYUSER3);
    sdtDeployerSigner = await ethers.provider.getSigner(SDT_DEPLOYER);

    await network.provider.send("hardhat_setBalance", [sdtWhaleSigner._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [timelock._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [sdFXSWhaleSigner._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [sdAngleWhaleSigner._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [dummyUser._address, parseEther("10").toHexString()]);

    const GaugeController = await ethers.getContractFactory("GaugeController");
    const LiquidityGaugeV4 = await ethers.getContractFactory("LiquidityGaugeV4");
    const SdtDistributor = await ethers.getContractFactory("SdtDistributor");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    //const VeBoost = await ethers.getContractFactory("veBoost");
    const VeBoostProxy = await ethers.getContractFactory("veBoostProxy");
    const FxsAccumulator = await ethers.getContractFactory("FxsAccumulator");
    const AngleAccumulator = await ethers.getContractFactory("AngleAccumulator");

    // Deploy
    gc = await GaugeController.connect(deployer).deploy(sdt.address, veSDTProxy.address, deployer.address);
    proxyAdmin = await ProxyAdmin.deploy();
    fxsAccumulator = await FxsAccumulator.deploy(fxs.address);
    angleAccumulator = await AngleAccumulator.deploy(sanUsdcEur.address);

    // set lockers into accumulators
    await fxsAccumulator.setLocker(fxsLocker.address);
    await angleAccumulator.setLocker(angleLocker.address);

    // set accumulator into the locker
    await fxsLocker.connect(sdtDeployerSigner).setAccumulator(fxsAccumulator.address);
    await angleLocker.connect(sdtDeployerSigner).setAccumulator(angleAccumulator.address);

    // Contracts upgradeable
    sdtDistributor = await SdtDistributor.deploy();
    lgv4FXSLogic = await LiquidityGaugeV4.deploy();
    lgv4ANGLELogic = await LiquidityGaugeV4.deploy();

    veBoostProxy = await VeBoostProxy.deploy(
      veSDTProxy.address,
      "0x0000000000000000000000000000000000000000",
      deployer.address
    );
    //veBoost = await VeBoost.deploy(deployer.address, veSDTProxy.address, "veboost delegation", "veBoost", "ipfs://");

    let ABI_SDTD = [
      "function initialize(address _rewardToken, address _controller, address _masterchef, address governor, address guardian, address _delegate_gauge)"
    ];
    let iface = new ethers.utils.Interface(ABI_SDTD);
    const dataSdtD = iface.encodeFunctionData("initialize", [
      sdt.address,
      gc.address,
      masterchef.address,
      deployer.address,
      deployer.address,
      deployer.address
    ]);

    sdtDProxy = await Proxy.connect(deployer).deploy(sdtDistributor.address, proxyAdmin.address, dataSdtD);
    sdtDProxy = await ethers.getContractAt("SdtDistributor", sdtDProxy.address);

    let ABI_LGV4 = [
      "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
    ];
    let iface_gv4 = new ethers.utils.Interface(ABI_LGV4);
    const dataFxsGauge = iface_gv4.encodeFunctionData("initialize", [
      sdFXS,
      deployer.address,
      sdt.address,
      veSDTProxy.address,
      veBoostProxy.address,
      sdtDProxy.address
    ]);
    const dataAngleGauge = iface_gv4.encodeFunctionData("initialize", [
      sdANGLE,
      deployer.address,
      sdt.address,
      veSDTProxy.address,
      veBoostProxy.address,
      sdtDProxy.address
    ]);

    fxsPPSGaugeProxy = await Proxy.connect(deployer).deploy(lgv4FXSLogic.address, proxyAdmin.address, dataFxsGauge);
    anglePPSGaugeProxy = await Proxy.connect(deployer).deploy(
      lgv4ANGLELogic.address,
      proxyAdmin.address,
      dataAngleGauge
    );
    fxsPPSGaugeProxy = await ethers.getContractAt("LiquidityGaugeV4", fxsPPSGaugeProxy.address);
    anglePPSGaugeProxy = await ethers.getContractAt("LiquidityGaugeV4", anglePPSGaugeProxy.address);

    // // set reward distributor
    await fxsPPSGaugeProxy.add_reward(fxs.address, fxsAccumulator.address);
    await anglePPSGaugeProxy.add_reward(sanUsdcEur.address, angleAccumulator.address);
    //const distributor = await fxsPPSGaugeProxy.reward_data()

    // Add gauge types
    const typesWeight = parseEther("1");
    await gc.connect(deployer)["add_type(string,uint256)"]("Mainnet staking", typesWeight); // 0
    await gc.connect(deployer)["add_type(string,uint256)"]("External", typesWeight); // 1
    await gc.connect(deployer)["add_type(string,uint256)"]("Cross Chain", typesWeight); // 2

    // add FXS and ANGLE gauges into gaugeController
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](fxsPPSGaugeProxy.address, 0, 0); // gauge - type - weight
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](anglePPSGaugeProxy.address, 0, 0);
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](dummyUser3._address, 2, 0); // add type 2 gauge
    // add external gauge
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](SDT_DEPLOYER, 1, 0); // simulate an external gauge

    const typeZeroWeight = await gc.get_type_weight(0);
    const typeOneWeight = await gc.get_type_weight(1);
    expect(typeZeroWeight).to.be.eq(typesWeight);
    expect(typeOneWeight).to.be.eq(typesWeight);

    const fxsGaugeWeight = await gc.get_gauge_weight(fxsPPSGaugeProxy.address);
    const angleGaugeWeight = await gc.get_gauge_weight(fxsPPSGaugeProxy.address);
    const externalGaugeWeight = await gc.get_gauge_weight(SDT_DEPLOYER);
    expect(fxsGaugeWeight).to.be.eq(0);
    expect(angleGaugeWeight).to.be.eq(0);
    expect(externalGaugeWeight).to.be.eq(0);

    // set gauge into the accumulator
    await fxsAccumulator.setGauge(fxsPPSGaugeProxy.address);
    await angleAccumulator.setGauge(anglePPSGaugeProxy.address);

    // Lock SDT for 4 years
    const sdtToLock = parseEther("10");
    const unlockTime = 60 * 60 * 24 * 365 * 4; // 4 years
    await sdt.connect(sdtWhaleSigner).approve(veSDTProxy.address, sdtToLock);
    await veSDTProxy.connect(sdtWhaleSigner).create_lock(sdtToLock, (await getNow()) + unlockTime);

    /** Masterchef <> SdtDistributor setup */
    const masterToken = await sdtDProxy.masterchefToken();
    await masterchef.connect(timelock).add(1000, masterToken, false);
    const poolsLength = await masterchef.poolLength();
    pidSdtD = poolsLength - 1;
    await sdtDProxy.connect(deployer).initializeMasterchef(pidSdtD);
    await sdtDProxy.connect(deployer).setDistribution(true);

    await sdfxs.connect(sdFXSWhaleSigner).transfer(SDTWHALE, parseEther("1"));
    await sdangle.connect(sdAngleWhaleSigner).transfer(SDTWHALE, parseEther("1"));

    await sdfxs.connect(sdFXSWhaleSigner).transfer(DUMMYUSER, parseEther("1"));
    await sdangle.connect(sdAngleWhaleSigner).transfer(DUMMYUSER, parseEther("1"));
    await sdt.connect(sdtWhaleSigner).transfer(DUMMYUSER, parseEther("1"));

    await sdfxs.connect(sdFXSWhaleSigner).transfer(DUMMYUSER2, parseEther("1"));
    await sdt.connect(sdtWhaleSigner).transfer(DUMMYUSER2, parseEther("1"));

    await sdfxs.connect(sdFXSWhaleSigner).transfer(DUMMYUSER3, parseEther("1"));
    await sdt.connect(sdtWhaleSigner).transfer(DUMMYUSER3, parseEther("1"));
  });

  it("should vote for pps gauges", async () => {
    const wholePercent = 10000;
    const angleVotePerc = 8000; // 80%
    const fxsVotePerc = 2000; // 20%
    const veSDTBalance = await veSDTProxy["balanceOf(address)"](sdtWhaleSigner._address);

    // vote
    await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(anglePPSGaugeProxy.address, angleVotePerc);
    await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(fxsPPSGaugeProxy.address, fxsVotePerc);

    // check vote correctness
    const angleGW = await gc.get_gauge_weight(anglePPSGaugeProxy.address);
    const fxsGW = await gc.get_gauge_weight(fxsPPSGaugeProxy.address);

    // the total amount of veSDT that can be used to vote is based on the next slope
    expect(angleGW).to.be.lt(veSDTBalance.div(wholePercent).mul(angleVotePerc));
    expect(angleGW).to.be.gt(veSDTBalance.div(wholePercent).mul(angleVotePerc).sub(parseEther("1")));
    expect(fxsGW).to.be.lt(veSDTBalance.div(wholePercent).mul(fxsVotePerc));
    expect(fxsGW).to.be.gt(veSDTBalance.div(wholePercent).mul(fxsVotePerc).sub(parseEther("1")));

    const totalWeight = await gc.get_total_weight();
    expect(totalWeight).to.be.eq(angleGW.add(fxsGW).mul(parseEther("1")));

    // fetch the gauge relative weight, max 1 (100%), from the previous week, it needs to be 0
    const angleGRW = await gc["gauge_relative_weight(address)"](anglePPSGaugeProxy.address);
    const fxsGRW = await gc["gauge_relative_weight(address)"](fxsPPSGaugeProxy.address);
    expect(angleGRW).to.be.eq(0);
    expect(fxsGRW).to.be.eq(0);
  });

  it("should call gauges checkpoint after 1 week", async () => {
    // increase the timestamp by 1 week
    await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]);
    await network.provider.send("evm_mine", []);

    // call checkpoint, it calculates the weight, for each gauge, based on the previous 7 days of vote
    await gc.checkpoint_gauge(anglePPSGaugeProxy.address);

    const angleGRWA = await gc["gauge_relative_weight(address)"](anglePPSGaugeProxy.address);
    const fxsGRWA = await gc["gauge_relative_weight(address)"](fxsPPSGaugeProxy.address);
    expect(angleGRWA).to.be.gt(parseEther("0.8")); // 80%
    expect(fxsGRWA).to.be.lt(parseEther("0.2")); // 20%
  });

  it("should claim rewards from the fxs locker", async function () {
    this.enableTimeouts(false);
    await fxsAccumulator.claimAndNotifyAll();
    const rewardBalance = await fxs.balanceOf(fxsPPSGaugeProxy.address);
    expect(rewardBalance).to.be.gt(0);
  });

  it("should claim rewards from the angle locker", async function () {
    this.enableTimeouts(false);
    await angleAccumulator.claimAndNotifyAll();
    const rewardBalance = await sanUsdcEur.balanceOf(anglePPSGaugeProxy.address);
    expect(rewardBalance).to.be.gt(0);
  });

  it("it should not able to addGauge when not governor", async function () {
    const tx = await sdtDProxy
      .connect(sdtWhaleSigner)
      .approveGauge(fxsPPSGaugeProxy.address)
      .catch((e: any) => e);
    expect(tx.message).to.have.string(
      `AccessControl: account ${sdtWhaleSigner._address.toLowerCase()} is missing role 0x7935bd0ae54bc31f548c14dba4d37c5c64b3f8ca900cb468fb8abd54d5894f55`
    );
  });
  it("it should be able to addGauge when  governor", async function () {
    const sdtDistributorFXSApproveBefore = await sdt.allowance(sdtDProxy.address, fxsPPSGaugeProxy.address);
    const sdtDistributorAngleApproveBefore = await sdt.allowance(sdtDProxy.address, anglePPSGaugeProxy.address);
    await sdtDProxy.approveGauge(fxsPPSGaugeProxy.address);
    await sdtDProxy.approveGauge(anglePPSGaugeProxy.address);
    const sdtDistributorFXSApproveAfter = await sdt.allowance(sdtDProxy.address, fxsPPSGaugeProxy.address);
    const sdtDistributorAngleApproveAfter = await sdt.allowance(sdtDProxy.address, anglePPSGaugeProxy.address);

    expect(sdtDistributorAngleApproveBefore).to.be.eq(0);
    expect(sdtDistributorFXSApproveBefore).to.be.eq(0);
    expect(sdtDistributorFXSApproveAfter).to.be.equal(ethers.constants.MaxUint256);
    expect(sdtDistributorAngleApproveAfter).to.be.equal(ethers.constants.MaxUint256);
  });
  it("should distribute rewards", async () => {
    await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]); // 1 week

    await gc["gauge_relative_weight_write(address)"](fxsPPSGaugeProxy.address);
    await gc["gauge_relative_weight_write(address)"](anglePPSGaugeProxy.address);
    const sdtAmountFxsBeforeDistribute = await sdt.balanceOf(fxsPPSGaugeProxy.address);
    const sdtAmountAngleBeforeDistribute = await sdt.balanceOf(anglePPSGaugeProxy.address);
    const tx = await (await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address, anglePPSGaugeProxy.address])).wait();
    const sdtAmountFxsAfterDistribute = await sdt.balanceOf(fxsPPSGaugeProxy.address);
    const sdtAmountAngleAfterDistribute = await sdt.balanceOf(anglePPSGaugeProxy.address);
    expect(sdtAmountFxsAfterDistribute).to.be.gt(sdtAmountFxsBeforeDistribute);
    expect(sdtAmountAngleAfterDistribute).to.be.gt(sdtAmountAngleBeforeDistribute);
    expect(tx.events.filter((_: any) => _.event === "RewardDistributed")[0].args.gaugeAddr).to.be.eq(
      fxsPPSGaugeProxy.address
    );
    expect(tx.events.filter((_: any) => _.event === "RewardDistributed")[1].args.gaugeAddr).to.be.eq(
      anglePPSGaugeProxy.address
    );
  });
  it("it should not distribute rewards since one day did not passed since last distribution", async () => {
    const sdtAmountFxsBeforeDistribute = await sdt.balanceOf(fxsPPSGaugeProxy.address);
    const sdtAmountAngleBeforeDistribute = await sdt.balanceOf(anglePPSGaugeProxy.address);
    const tx = await (await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address, anglePPSGaugeProxy.address])).wait();
    const sdtAmountFxsAfterDistribute = await sdt.balanceOf(fxsPPSGaugeProxy.address);
    const sdtAmountAngleAfterDistribute = await sdt.balanceOf(anglePPSGaugeProxy.address);
    expect(sdtAmountFxsAfterDistribute).to.be.eq(sdtAmountFxsBeforeDistribute);
    expect(sdtAmountAngleAfterDistribute).to.be.eq(sdtAmountAngleBeforeDistribute);
    expect(tx.events.filter((_: any) => _.event === "RewardDistributed").length).to.be.eq(0);
  });
  it("should distribute rewards again after one day", async () => {
    await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
    await network.provider.send("evm_mine", []);

    const sdtAmountFxsBeforeDistribute = await sdt.balanceOf(fxsPPSGaugeProxy.address);
    const sdtAmountAngleBeforeDistribute = await sdt.balanceOf(anglePPSGaugeProxy.address);
    const tx = await (await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address, anglePPSGaugeProxy.address])).wait();
    const sdtAmountFxsAfterDistribute = await sdt.balanceOf(fxsPPSGaugeProxy.address);
    const sdtAmountAngleAfterDistribute = await sdt.balanceOf(anglePPSGaugeProxy.address);
    expect(sdtAmountFxsAfterDistribute).to.be.gt(sdtAmountFxsBeforeDistribute);
    expect(sdtAmountAngleAfterDistribute).to.be.gt(sdtAmountAngleBeforeDistribute);
    expect(tx.events.filter((_: any) => _.event === "RewardDistributed")[0].args.gaugeAddr).to.be.eq(
      fxsPPSGaugeProxy.address
    );
    expect(tx.events.filter((_: any) => _.event === "RewardDistributed")[1].args.gaugeAddr).to.be.eq(
      anglePPSGaugeProxy.address
    );
  });

  it("it should not distribute rewards to killed gauge", async () => {
    await sdtDProxy.toggleGauge(fxsPPSGaugeProxy.address);
    const sdtDistributorFXSApprove = await sdt.allowance(sdtDProxy.address, fxsPPSGaugeProxy.address);
    await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]); // 1 week
    await network.provider.send("evm_mine", []);
    const tx = await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address]).catch((e: any) => e);
    expect(sdtDistributorFXSApprove).to.be.equal(0);
    expect(tx.message).to.have.string("Unrecognized or killed gauge");
  });

  it("it should add wallet as gauge and distribute rewards to wallet", async () => {
    const angleVotePerc = 5000; // 50%
    const walletGaugeVotePerc = 5000; // 50%
    // vote
    await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(fxsPPSGaugeProxy.address, 0);
    await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(anglePPSGaugeProxy.address, angleVotePerc);
    await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(dummyUser3._address, walletGaugeVotePerc);
    // increase the timestamp by 1 week
    await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]);
    await network.provider.send("evm_mine", []);

    // call checkpoint, it calculates the weight, for each gauge, based on the previous 7 days of vote
    await gc.checkpoint_gauge(anglePPSGaugeProxy.address);

    const sdtBalanceOfwalletGaugeBeforeDistribute = await sdt.balanceOf(deployer.address);
    const tx = await (await sdtDProxy.distributeMulti([dummyUser3._address, anglePPSGaugeProxy.address])).wait();
    const sdtBalanceOfwalletGaugeAfterDistribute = await sdt.balanceOf(deployer.address);
    expect(sdtBalanceOfwalletGaugeAfterDistribute).to.be.gt(sdtBalanceOfwalletGaugeBeforeDistribute);
    expect(tx.events.filter((_: any) => _.event === "RewardDistributed")[0].args.gaugeAddr).to.be.eq(
      dummyUser3._address
    );
    expect(tx.events.filter((_: any) => _.event === "RewardDistributed")[1].args.gaugeAddr).to.be.eq(
      anglePPSGaugeProxy.address
    );
  });

  it("it should be able to change distribution period of the sdt", async () => {
    await sdtDProxy.setTimePeriod(60 * 60 * 24 * 7); // set new distribution period to 1 week
    await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
    await network.provider.send("evm_mine", []);
    const tx = await (await sdtDProxy.distributeMulti([dummyUser3._address, anglePPSGaugeProxy.address])).wait();
    expect(tx.events.filter((_: any) => _.event === "RewardDistributed").length).to.be.eq(0); // it should not distribute any rewards since new distribution period is 1 week
  });

  it("it should not distribute rewards if gauge is not set on gaugecontroller", async () => {
    const tx = await sdtDProxy.distributeMulti([dummyUser2._address]).catch((e: any) => e);
    expect(tx.message).not.be.empty;
  });

  it("it should toggle an interface known", async () => {
    // simulate a toggle interface for managing gauges of type >=2
    await sdtDProxy.toggleInterfaceKnown(FAKE_INTERFACE_KNOWN);
  });

  it("it should set a delegate gauge", async () => {
    // simulate a toggle interface for managing gauges of type >=2
    await sdtDProxy.setDelegateGauge(TIMELOCK, TIMELOCK, false);
    await sdtDProxy.setDelegateGauge(ethers.constants.AddressZero, TIMELOCK, true);
  });

  it("it should set a new gauge controller", async () => {
    // set a new gauge controller
    await sdtDProxy.setGaugeController(TIMELOCK);
    const gaugeController = await sdtDProxy.controller();
    expect(gaugeController).eq(TIMELOCK);
    await sdtDProxy.setGaugeController(gc.address);
    const newGaugeController = await sdtDProxy.controller();
    expect(newGaugeController).eq(gc.address);
  }); 

  it("it should rescue ERC20", async () => {
    const amountToRescue = parseEther("1");
    const balanceBefore = await sdt.balanceOf(deployer.address);
    await sdt.connect(sdtWhaleSigner).transfer(sdtDProxy.address, amountToRescue);
    await sdtDProxy.recoverERC20(sdt.address, deployer.address, amountToRescue);
    const balanceAfter = await sdt.balanceOf(deployer.address);
    expect(balanceAfter.sub(balanceBefore)).eq(amountToRescue);
  });
});

// because we could test the amount received in 3 different use cases:
// 1) User that stake sdFXS but does not hold any veSdT
// 2) User that stake sdFXS and hold veSDT without delegating any
// 2) User that stake sdFXS, hold veSDT, and delegated a part of them