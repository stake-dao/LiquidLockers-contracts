import { ethers, network } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { parseEther, parseUnits } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

const SDTWHALE = "0x48238Faf05BF8B745249dB3c26606A72149600B8";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VESDTP = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";

const sdFXS = "0x402F878BDd1f5C66FdAF0fabaBcF74741B68ac36"; // sdFXS
const sdANGLE = "0x752B4c6e92d96467fE9b9a2522EF07228E00F87c"; // sdANGLE

const ANGLE = "0x31429d1856aD1377A8A0079410B297e1a9e214c2";
const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const SAN_USDC_EUR = "0x9C215206Da4bf108aE5aEEf9dA7caD3352A36Dad";
const FXSNOTIFIER = "0x5180db0237291a6449dda9ed33ad90a38787621c";
const FRAX1 = "0x234D953a9404Bf9DbC3b526271d440cD2870bCd2";
const FXSAMO = "0xb524622901b3f7b5dea6501e9830700c847c7dc5";

const SAN = "0xcc617c6f9725eacc993ac626c7efc6b96476916e";
const BASESURPLUS = "0x2e2063080a05ffdaa6d57f9358c2a5e1c65c70ec";
const USDCWHALE = "0x72a53cdbbcc1b9efa39c834a540550e23463aacb";
const SANUSDCEURWHALE = "0x2298718F8C34aDb143BdCC017feAE24dE4a62653";

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

const FXS_DEPOSITOR = "0x070DF1b96059F5DC34FCB140Ffdc8c41d6eeF1cA";
const ANGLE_DEPOSITOR = "0x3449599Ff9Ae8459a7a24D33eee518627e8C88C9";

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("veSDT voting", () => {
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
  let veBoost: Contract;
  let veBoostProxy: Contract;
  let masterchef: Contract;
  let fxsAccumulator: Contract;
  let angleAccumulator: Contract;
  let fxsLocker: Contract;
  let angleLocker: Contract;
  let fxs: Contract;
  let sanUsdcEur: Contract;
  let FXS1559_AMO_V3: Contract;
  let surplusConverterSanTokens: Contract;
  let usdc: Contract;
  let claimRewards: Contract;
  let angleDepositorOld: Contract;
  let fxsDepositorOld: Contract;
  let angleDepositorNew: Contract;
  let fxsDepositorNew: Contract;
  let timelock: JsonRpcSigner;
  let sdtWhaleSigner: JsonRpcSigner;
  let sdFXSWhaleSigner: JsonRpcSigner;
  let sdAngleWhaleSigner: JsonRpcSigner;
  let sdtDeployerSigner: JsonRpcSigner;
  let deployer: SignerWithAddress;
  let dummyUser: JsonRpcSigner;
  let dummyUser2: JsonRpcSigner;
  let dummyUser3: JsonRpcSigner;
  let fxsNotifier: JsonRpcSigner;
  let frax1: JsonRpcSigner;
  let surplusCaller: JsonRpcSigner;
  let usdcWhale: JsonRpcSigner;
  let sanUsdcEurWhale: JsonRpcSigner;
  before(async function () {
    this.enableTimeouts(false);

    [deployer] = await ethers.getSigners();

    sdt = await ethers.getContractAt(ERC20, SDT);
    sdfxs = await ethers.getContractAt("sdToken", sdFXS);
    sdangle = await ethers.getContractAt("sdToken", sdANGLE);
    sww = await ethers.getContractAt("SmartWalletWhitelist", SWW);
    veSDTProxy = await ethers.getContractAt("veSDT", VESDTP);
    masterchef = await ethers.getContractAt(MASTERCHEFABI, MASTERCHEF);
    fxsLocker = await ethers.getContractAt("FxsLocker", FXS_LOCKER);
    angleLocker = await ethers.getContractAt("AngleLocker", ANGLE_LOCKER);
    fxs = await ethers.getContractAt(ERC20, FXS);
    sanUsdcEur = await ethers.getContractAt(ERC20, SAN_USDC_EUR);
    usdc = await ethers.getContractAt(ERC20, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
    FXS1559_AMO_V3 = await ethers.getContractAt("IFXS1559_AMO_V3", FXSAMO);
    surplusConverterSanTokens = await ethers.getContractAt("ISurplusConverterSanTokens", BASESURPLUS);
    // use the abi related to the new Depositor, but it needs only for calling the set operator
    fxsDepositorOld = await ethers.getContractAt("Depositor", FXS_DEPOSITOR);
    angleDepositorOld = await ethers.getContractAt("Depositor", ANGLE_DEPOSITOR);

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

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FXSNOTIFIER]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FRAX1]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SAN]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDCWHALE]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SANUSDCEURWHALE]
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
    await deployer.sendTransaction({
      to: FXSNOTIFIER,
      value: ethers.utils.parseEther("100") // 1 ether
    });
    await deployer.sendTransaction({
      to: FRAX1,
      value: ethers.utils.parseEther("100") // 1 ether
    });
    await deployer.sendTransaction({
      to: USDCWHALE,
      value: ethers.utils.parseEther("100") // 1 ether
    });
    await deployer.sendTransaction({
      to: SANUSDCEURWHALE,
      value: ethers.utils.parseEther("100") // 1 ether
    });

    sdtWhaleSigner = await ethers.provider.getSigner(SDTWHALE);
    sdFXSWhaleSigner = await ethers.provider.getSigner(sdFXSWHALE);
    sdAngleWhaleSigner = await ethers.provider.getSigner(sdANGLEWHALE);
    sanUsdcEurWhale = await ethers.provider.getSigner(SANUSDCEURWHALE);
    timelock = await ethers.provider.getSigner(TIMELOCK);
    dummyUser = await ethers.provider.getSigner(DUMMYUSER);
    dummyUser2 = await ethers.provider.getSigner(DUMMYUSER2);
    dummyUser3 = await ethers.provider.getSigner(DUMMYUSER3);
    fxsNotifier = await ethers.provider.getSigner(FXSNOTIFIER);
    frax1 = await ethers.provider.getSigner(FRAX1);
    surplusCaller = await ethers.provider.getSigner(SAN);
    sdtDeployerSigner = await ethers.provider.getSigner(SDT_DEPLOYER);
    usdcWhale = await ethers.provider.getSigner(USDCWHALE);

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
    const ClaimRewards = await ethers.getContractFactory("ClaimRewards");
    const NewDepositor = await ethers.getContractFactory("Depositor");

    // New depositor migration
    angleDepositorNew = await NewDepositor.deploy(ANGLE, ANGLE_LOCKER, sdangle.address);
    fxsDepositorNew = await NewDepositor.deploy(FXS, FXS_LOCKER, sdfxs.address);

    // set new operators
    await angleDepositorOld.connect(sdtDeployerSigner).setSdTokenOperator(angleDepositorNew.address);
    await fxsDepositorOld.connect(sdtDeployerSigner).setSdTokenOperator(fxsDepositorNew.address);

    // set new depositor on lockers
    await angleLocker.connect(sdtDeployerSigner).setAngleDepositor(angleDepositorNew.address);
    await fxsLocker.connect(sdtDeployerSigner).setFxsDepositor(fxsDepositorNew.address);

    // Deploy
    gc = await GaugeController.connect(deployer).deploy(sdt.address, veSDTProxy.address, deployer.address);
    proxyAdmin = await ProxyAdmin.deploy();
    fxsAccumulator = await FxsAccumulator.deploy(fxs.address);
    angleAccumulator = await AngleAccumulator.deploy(sanUsdcEur.address);
    claimRewards = await ClaimRewards.deploy();

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

    // set gauges into the depositors
    await fxsDepositorNew.setGauge(fxsPPSGaugeProxy.address);
    await angleDepositorNew.setGauge(anglePPSGaugeProxy.address);

    // set reward distributor
    await fxsPPSGaugeProxy.add_reward(fxs.address, fxsAccumulator.address);
    await anglePPSGaugeProxy.add_reward(sanUsdcEur.address, angleAccumulator.address);
    await fxsPPSGaugeProxy.set_claimer(claimRewards.address);
    await anglePPSGaugeProxy.set_claimer(claimRewards.address);

    // Add gauge types
    const typesWeight = parseEther("1");
    await gc.connect(deployer)["add_type(string,uint256)"]("Mainnet staking", typesWeight); // 0
    await gc.connect(deployer)["add_type(string,uint256)"]("External", typesWeight); // 1

    // add FXS and ANGLE gauges into gaugeController
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](fxsPPSGaugeProxy.address, 0, 0); // gauge - type - weight
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](anglePPSGaugeProxy.address, 0, 0);

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

    // set gauges and depositors on claim reward contract
    await claimRewards.enableGauge(fxsPPSGaugeProxy.address);
    await claimRewards.enableGauge(anglePPSGaugeProxy.address);
    await claimRewards.addDepositor(fxs.address, fxsDepositorNew.address);
    await claimRewards.addDepositor(ANGLE, angleDepositorNew.address);

    // Lock SDT for 4 years
    const sdtToLock = parseEther("10");
    const unlockTime = 60 * 60 * 24 * 365 * 4; // 4 years
    await sdt.connect(sdtWhaleSigner).approve(veSDTProxy.address, sdtToLock);
    await veSDTProxy.connect(sdtWhaleSigner).create_lock(sdtToLock, (await getNow()) + unlockTime);

    /** Masterchef <> SdtDistributor setup */
    const masterToken = await sdtDProxy.masterchefToken();
    await masterchef.connect(timelock).add(1000, masterToken, false);
    const poolsLength = await masterchef.poolLength();
    const pidSdtD = poolsLength - 1;
    await sdtDProxy.connect(deployer).initializeMasterchef(pidSdtD);
    await sdtDProxy.connect(deployer).setDistribution(true);

    await sdfxs.connect(sdFXSWhaleSigner).transfer(SDTWHALE, parseEther("1"));
    await sdangle.connect(sdAngleWhaleSigner).transfer(SDTWHALE, parseEther("0.5"));

    await sdfxs.connect(sdFXSWhaleSigner).transfer(DUMMYUSER, parseEther("1"));
    await sdangle.connect(sdAngleWhaleSigner).transfer(DUMMYUSER, parseEther("0.5"));
    await sdt.connect(sdtWhaleSigner).transfer(DUMMYUSER, parseEther("1"));

    await sdfxs.connect(sdFXSWhaleSigner).transfer(DUMMYUSER2, parseEther("1"));
    await sdt.connect(sdtWhaleSigner).transfer(DUMMYUSER2, parseEther("1"));
    await sdangle.connect(sdAngleWhaleSigner).transfer(DUMMYUSER2, parseEther("0.5"));

    await sdfxs.connect(sdFXSWhaleSigner).transfer(DUMMYUSER3, parseEther("1"));
    await sdt.connect(sdtWhaleSigner).transfer(DUMMYUSER3, parseEther("1"));
    await sdangle.connect(sdAngleWhaleSigner).transfer(DUMMYUSER3, parseEther("0.5"));

    // await usdc.connect(usdcWhale).transfer(surplusCaller._address, "100000000000");
    // await usdc.connect(usdcWhale).transfer("0x5addc89785d75c86ab939e9e15bfbbb7fc086a87", "100000000000");
    await usdc.connect(usdcWhale).transfer(BASESURPLUS, "300000000000");
  });

  describe("GaugeController", async () => {
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
  });

  describe("Accumulator", async () => {
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
  });

  describe("SdtDistributor", async () => {
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
      await network.provider.send("evm_mine", []);

      // await gc.checkpoint_gauge(fxsPPSGaugeProxy.address);
      // await gc.checkpoint_gauge(anglePPSGaugeProxy.address);
      await gc["gauge_relative_weight_write(address)"](fxsPPSGaugeProxy.address);
      await gc["gauge_relative_weight_write(address)"](anglePPSGaugeProxy.address);

      await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address]);

      const sdtAmountFxs = await sdt.balanceOf(fxsPPSGaugeProxy.address);
      const sdtAmountAngle = await sdt.balanceOf(anglePPSGaugeProxy.address);

      console.log("sdtAmountFxs", sdtAmountFxs.toString());
      console.log("sdtAmountAngle", sdtAmountAngle.toString());

      const sdtA = await sdt.balanceOf(sdtDProxy.address);
      console.log("sdt distributor balance ", sdtA.toString());

      console.log("---------------------------------");
      console.log("---------------------------------");
      console.log("---------------------------------");

      await sdtDProxy.distributeMulti([anglePPSGaugeProxy.address]);

      const sdtAmountFxs2 = await sdt.balanceOf(fxsPPSGaugeProxy.address);
      const sdtAmountAngle2 = await sdt.balanceOf(anglePPSGaugeProxy.address);

      console.log("sdtAmountFxs2", sdtAmountFxs2.toString());
      console.log("sdtAmountAngle2", sdtAmountAngle2.toString());

      const sdtA2 = await sdt.balanceOf(sdtDProxy.address);
      console.log("sdt distributor balance2 ", sdtA2.toString());
      // expect(sdtA2.add(sdtA)).eq(sdt);
    });

    it("user depositing sdFXS should be able to claim correct amount of rewards", async () => {
      // Users claim from frax, gauges, they should receive correct amount of SDT

      var sdtBefore = await sdt.balanceOf(SDTWHALE);
      await sdfxs.connect(sdtWhaleSigner).approve(fxsPPSGaugeProxy.address, parseEther("1"));

      await fxsPPSGaugeProxy.connect(sdtWhaleSigner)["deposit(uint256)"](parseEther("1"));
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]); // 1 week
      await network.provider.send("evm_mine", []);

      await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address]);

      await fxsPPSGaugeProxy.connect(sdtWhaleSigner)["claim_rewards()"]();

      var sdtAfter = await sdt.balanceOf(SDTWHALE);

      expect(sdtAfter).gt(sdtBefore);
      console.log("SDT received: " + sdtAfter.sub(sdtBefore).toString());
    });

    it("user depositing sdAngle should be able to claim correct amount of rewards", async () => {
      // Users claim from frax, gauges, they should receive correct amount of SDT

      var sdtBefore = await sdt.balanceOf(SDTWHALE);
      await sdangle.connect(sdtWhaleSigner).approve(anglePPSGaugeProxy.address, parseEther("0.5"));
      await anglePPSGaugeProxy.connect(sdtWhaleSigner)["deposit(uint256)"](parseEther("0.5"));
      await sdtDProxy.distributeMulti([anglePPSGaugeProxy.address]);

      await anglePPSGaugeProxy.connect(sdtWhaleSigner)["claim_rewards()"]();
      var sdtAfter = await sdt.balanceOf(SDTWHALE);

      expect(sdtAfter).gt(sdtBefore);
      console.log("SDT received: " + sdtAfter.sub(sdtBefore).toString());
    });

    it("sdFXS staked with no veSDT", async () => {
      var sdtBefore = await sdt.balanceOf(DUMMYUSER);
      await sdfxs.connect(dummyUser).approve(fxsPPSGaugeProxy.address, parseEther("1"));
      await fxsPPSGaugeProxy.connect(dummyUser)["deposit(uint256)"](parseEther("1"));
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]); // 1 week
      await network.provider.send("evm_mine", []);
      await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address]);

      await fxsPPSGaugeProxy.connect(dummyUser)["claim_rewards()"]();
      var sdtAfter = await sdt.balanceOf(DUMMYUSER);

      expect(sdtAfter).gt(sdtBefore);
      console.log("SDT received: " + sdtAfter.sub(sdtBefore).toString());
    });

    it("sdFXS staked with veSDT but no delegation", async () => {
      await sdt.connect(dummyUser).approve(veSDTProxy.address, parseEther("1"));
      await veSDTProxy.connect(dummyUser).create_lock(parseEther("1"), (await getNow()) + 60 * 60 * 24 * 365 * 4);
      var sdtBefore = await sdt.balanceOf(DUMMYUSER);
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]); // 1 week
      await network.provider.send("evm_mine", []);
      await gc["gauge_relative_weight_write(address)"](fxsPPSGaugeProxy.address);
      await gc["gauge_relative_weight_write(address)"](anglePPSGaugeProxy.address);
      await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address]);

      await fxsPPSGaugeProxy.connect(dummyUser)["claim_rewards()"]();
      var sdtAfter = await sdt.balanceOf(DUMMYUSER);

      console.log("SDT received: " + sdtAfter.sub(sdtBefore).toString());
      expect(sdtAfter).gt(sdtBefore);
    });

    it("sdFXS staked with veSDT and some veSDT delegation", async () => {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]); // 1 week
      await network.provider.send("evm_mine", []);

      let blockNum = await ethers.provider.getBlockNumber();
      let block = await ethers.provider.getBlock(blockNum);
      var time = block.timestamp;
      // await veBoost
      //   .connect(sdtWhaleSigner)
      //   ["create_boost(address,address,int256,uint256,uint256,uint256)"](
      //     sdtWhaleSigner._address,
      //     dummyUser._address,
      //     5_000,
      //     0,
      //     time + 86400 * 14,
      //     0
      //   );

      var sdtBefore = await sdt.balanceOf(DUMMYUSER);

      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]); // 1 week
      await network.provider.send("evm_mine", []);
      await gc["gauge_relative_weight_write(address)"](fxsPPSGaugeProxy.address);
      await gc["gauge_relative_weight_write(address)"](anglePPSGaugeProxy.address);
      await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address]);

      await fxsPPSGaugeProxy.connect(dummyUser)["claim_rewards()"]();

      var sdtAfter = await sdt.balanceOf(DUMMYUSER);

      console.log("SDT received: " + sdtAfter.sub(sdtBefore).toString());

      expect(sdtAfter).gt(sdtBefore);
    });

    it("Should deposit sdToken into gauges", async function () {
      this.enableTimeouts(false);
      // deposit 1 sdFxs and 1 sdAngle
      var lockTime = (await getNow()) + 60 * 60 * 24 * 365 * 4;
      await sdfxs.connect(dummyUser2).approve(fxsPPSGaugeProxy.address, parseEther("1"));
      await fxsPPSGaugeProxy.connect(dummyUser2)["deposit(uint256)"](parseEther("1"));
      await sdangle.connect(dummyUser2).approve(anglePPSGaugeProxy.address, parseEther("0.5"));
      await anglePPSGaugeProxy.connect(dummyUser2)["deposit(uint256)"](parseEther("0.5"));
      await sdt.connect(dummyUser2).approve(veSDTProxy.address, parseEther("1"));
      await veSDTProxy.connect(dummyUser2).create_lock(parseEther("1"), lockTime);
    });

    it("Should claim FXS, sanUSDC_EUR and SDT rewards", async function () {
      this.enableTimeouts(false);
      //Adding FXS rewards
      await (await FXS1559_AMO_V3.connect(frax1).swapBurn(parseEther("100"), true)).wait();
      await surplusConverterSanTokens
        .connect(surplusCaller)
        ["buyback(address,uint256,uint256,bool)"](
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          "300000000000",
          "90000000000",
          true
        );
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 0.5]); // half day
      await network.provider.send("evm_mine", []);

      await sanUsdcEur.connect(sanUsdcEurWhale).transfer(angleAccumulator.address, parseUnits("10", "6"));
      await fxsAccumulator.claimAndNotifyAll();
      await angleAccumulator.claimAndNotifyAll();

      const fxsBefore = await fxs.balanceOf(dummyUser2._address);
      const sanLPBefore = await sanUsdcEur.balanceOf(dummyUser2._address);
      const sdtBefore = await sdt.balanceOf(dummyUser2._address);
      await claimRewards.connect(dummyUser2).claimRewards([fxsPPSGaugeProxy.address, anglePPSGaugeProxy.address]);
      const sanLPAfter = await sanUsdcEur.balanceOf(dummyUser2._address);
      const sdtAfter = await sdt.balanceOf(dummyUser2._address);
      const fxsAfter = await fxs.balanceOf(dummyUser2._address);
      expect(fxsAfter).gt(fxsBefore);
      expect(sanLPAfter).gt(sanLPBefore);
      expect(sdtAfter).gt(sdtBefore);
    });

    it("Should claim FXS, sanUSDC_EUR and SDT rewards not locking any token", async () => {
      // it behaves like the previous test, but the user claims the reward
      // using the claimAndLock function, passing the lockStatus structure
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 0.5]); // half day
      await network.provider.send("evm_mine", []);

      // 0 fxs
      // 1 angle
      const lockStatus = { locked: [false, false], staked: [false, false], lockSDT: false };
      const fxsBefore = await fxs.balanceOf(dummyUser2._address);
      const sanLPBefore = await sanUsdcEur.balanceOf(dummyUser2._address);
      const sdtBefore = await sdt.balanceOf(dummyUser2._address);
      await claimRewards
        .connect(dummyUser2)
        .claimAndLock([fxsPPSGaugeProxy.address, anglePPSGaugeProxy.address], lockStatus);
      const sanLPAfter = await sanUsdcEur.balanceOf(dummyUser2._address);
      const sdtAfter = await sdt.balanceOf(dummyUser2._address);
      const fxsAfter = await fxs.balanceOf(dummyUser2._address);
      expect(fxsAfter).gt(fxsBefore);
      expect(sanLPAfter).gt(sanLPBefore);
      expect(sdtAfter).gt(sdtBefore);
    });

    it("Should claim reward, lock FXS, receive sdFXS and sanLP token, and lock SDT", async () => {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 0.5]); // half day
      await network.provider.send("evm_mine", []);

      // 0 fxs
      // 1 angle
      const lockStatus = { locked: [true, true], staked: [false, false], lockSDT: true };

      const fxsBefore = await fxs.balanceOf(dummyUser2._address);
      const sanLPBefore = await sanUsdcEur.balanceOf(dummyUser2._address);
      const sdtBefore = await sdt.balanceOf(dummyUser2._address);
      const sdFxsBefore = await sdfxs.balanceOf(dummyUser2._address);
      const sdAngleBefore = await sdangle.balanceOf(dummyUser2._address);
      await claimRewards
        .connect(dummyUser2)
        .claimAndLock([fxsPPSGaugeProxy.address, anglePPSGaugeProxy.address], lockStatus);
      const fxsAfter = await fxs.balanceOf(dummyUser2._address);
      const sanLPAfter = await sanUsdcEur.balanceOf(dummyUser2._address);
      const sdtAfter = await sdt.balanceOf(dummyUser2._address);
      const sdFxsAfter = await sdfxs.balanceOf(dummyUser2._address);
      const sdAngleAfter = await sdangle.balanceOf(dummyUser2._address);

      expect(fxsAfter).eq(fxsBefore);
      expect(sanLPAfter).gt(sanLPBefore);
      expect(sdFxsAfter).gt(sdFxsBefore);
      expect(sdAngleAfter).eq(sdAngleBefore);
      expect(sdtAfter).eq(sdtBefore);
    });

    it("Should claim reward, lock FXS, stake sdFXS, receive sanLP token, and lock SDT", async () => {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 0.5]); // half day
      await network.provider.send("evm_mine", []);

      // 0 fxs
      // 1 angle
      const lockStatus = { locked: [true, true], staked: [true, true], lockSDT: true };

      const fxsBefore = await fxs.balanceOf(dummyUser2._address);
      const sanLPBefore = await sanUsdcEur.balanceOf(dummyUser2._address);
      const sdtBefore = await sdt.balanceOf(dummyUser2._address);
      const sdFxsBefore = await sdfxs.balanceOf(dummyUser2._address);
      const sdAngleBefore = await sdangle.balanceOf(dummyUser2._address);
      await claimRewards
        .connect(dummyUser2)
        .claimAndLock([fxsPPSGaugeProxy.address, anglePPSGaugeProxy.address], lockStatus);
      const fxsAfter = await fxs.balanceOf(dummyUser2._address);
      const sanLPAfter = await sanUsdcEur.balanceOf(dummyUser2._address);
      const sdtAfter = await sdt.balanceOf(dummyUser2._address);
      const sdFxsAfter = await sdfxs.balanceOf(dummyUser2._address);
      const sdAngleAfter = await sdangle.balanceOf(dummyUser2._address);

      expect(fxsAfter).eq(fxsBefore);
      expect(sanLPAfter).gt(sanLPBefore);
      expect(sdFxsAfter).eq(sdFxsBefore);
      expect(sdAngleAfter).eq(sdAngleBefore);
      expect(sdtAfter).eq(sdtBefore);
    });

    it("Should disable gauge", async () => {
      await claimRewards.disableGauge(fxsPPSGaugeProxy.address);
      const gaugeEnaled = await claimRewards.gauges(fxsPPSGaugeProxy.address);
      expect(gaugeEnaled).to.be.false;
      await claimRewards.enableGauge(fxsPPSGaugeProxy.address);
      const gaugeEnabledAfter = await claimRewards.gauges(fxsPPSGaugeProxy.address);
      expect(gaugeEnabledAfter).to.be.true;
    });

    it("Should set a new claimReward governance", async () => {
      await claimRewards.setGovernance(dummyUser2._address);
      const goverance = await claimRewards.governance();
      expect(goverance).eq(dummyUser2._address);
      await claimRewards.connect(dummyUser2).setGovernance(deployer.address);
    });

    it("Should rescue token", async () => {
      const amountToRescue = parseUnits("10", "6");
      await sanUsdcEur.connect(sanUsdcEurWhale).transfer(claimRewards.address, amountToRescue);
      const balanceBefore = await sanUsdcEur.balanceOf(dummyUser2._address);
      await claimRewards.rescueERC20(sanUsdcEur.address, amountToRescue, dummyUser2._address);
      const balanceAfter = await sanUsdcEur.balanceOf(dummyUser2._address);
      expect(balanceAfter.sub(balanceBefore)).eq(amountToRescue);
    });

    it("Should claim rewards from the accumulators", async () => {
      const amountToNotifyFxs = parseEther("0.0001");
      const fxsAccumulatorBalance = await fxs.balanceOf(fxsAccumulator.address);
      expect(fxsAccumulatorBalance).eq(0);
      await fxsAccumulator.claimAndNotify(amountToNotifyFxs);
      const fxsAccumulatorBalanceAfter = await fxs.balanceOf(fxsAccumulator.address);
      expect(fxsAccumulatorBalanceAfter).gt(0);

      const angleAccumulatorBalance = await sanUsdcEur.balanceOf(angleAccumulator.address);
      expect(angleAccumulatorBalance).eq(0);

      await sanUsdcEur.connect(sanUsdcEurWhale).transfer(angleAccumulator.address, parseUnits("10", "7"));
      const amountToNotifySanLP = parseUnits("10", "6");

      await angleAccumulator.claimAndNotify(amountToNotifySanLP);
      const angleAccumulatorBalanceAfter = await sanUsdcEur.balanceOf(angleAccumulator.address);
      expect(angleAccumulatorBalanceAfter).gt(0);
    });

    it("Should deposit tokens into the accumulator and rescue them", async () => {
      const amountToDeposit = parseEther("10");
      const balanceBefore = await sdt.balanceOf(fxsAccumulator.address);
      expect(balanceBefore).eq(0);

      // send sdt to the fxsAccumulator
      await sdt.connect(sdtWhaleSigner).approve(fxsAccumulator.address, amountToDeposit);
      await fxsAccumulator.connect(sdtWhaleSigner).depositToken(sdt.address, amountToDeposit);
      const balanceAfter = await sdt.balanceOf(fxsAccumulator.address);
      expect(balanceAfter).eq(amountToDeposit);

      // rescue sdt
      const sdtBalanceBefore = await sdt.balanceOf(dummyUser2._address);
      await fxsAccumulator.rescueERC20(sdt.address, amountToDeposit, dummyUser2._address);
      const sdtBalanceAfter = await sdt.balanceOf(dummyUser2._address);
      const sdtLeft = await sdt.balanceOf(fxsAccumulator.address);
      expect(sdtLeft).eq(0);
      expect(sdtBalanceAfter.sub(sdtBalanceBefore)).eq(amountToDeposit);
    });

    it("Should notify an extra token reward but it remains into the accumulator", async () => {
      const amountToNotify = parseUnits("10", "7");
      const balanceBefore = await sanUsdcEur.balanceOf(fxsAccumulator.address);
      expect(balanceBefore).eq(0);
      await sanUsdcEur.connect(sanUsdcEurWhale).transfer(fxsAccumulator.address, amountToNotify);
      await fxsAccumulator.notifyAllExtraReward(sanUsdcEur.address);
      await fxsAccumulator.notifyExtraReward(sanUsdcEur.address, amountToNotify);
      const balanceLeft = await sanUsdcEur.balanceOf(fxsAccumulator.address);
      expect(balanceLeft).eq(amountToNotify);
    });

    it("Should set a new fxsAccumulator governance", async () => {
      await fxsAccumulator.setGovernance(dummyUser2._address);
      const goverance = await fxsAccumulator.governance();
      expect(goverance).eq(dummyUser2._address);
      await fxsAccumulator.connect(dummyUser2).setGovernance(deployer.address);
    });

    it("Should set a new token reward", async () => {
      await fxsAccumulator.setTokenReward(ANGLE);
      const tokenReward = await fxsAccumulator.tokenReward();
      expect(tokenReward).eq(ANGLE);
    });

    // it("Boosted user receives more SDT compared to non-boosted", async function () {
    //   this.enableTimeouts(false);

    //   await sdfxs.connect(dummyUser2).approve(fxsPPSGaugeProxy.address, parseEther("1"));
    //   await fxsPPSGaugeProxy.connect(dummyUser2)["deposit(uint256)"](parseEther("1"));
    //   await sdfxs.connect(dummyUser3).approve(fxsPPSGaugeProxy.address, parseEther("1"));
    //   await fxsPPSGaugeProxy.connect(dummyUser3)["deposit(uint256)"](parseEther("1"));
    //   await sdangle.connect(dummyUser2).approve(anglePPSGaugeProxy.address, parseEther("0.5"));
    //   await anglePPSGaugeProxy.connect(dummyUser2)["deposit(uint256)"](parseEther("0.5"));
    //   await sdangle.connect(dummyUser3).approve(anglePPSGaugeProxy.address, parseEther("0.5"));
    //   await anglePPSGaugeProxy.connect(dummyUser3)["deposit(uint256)"](parseEther("0.5"));

    //   var lockTime = (await getNow()) + 60 * 60 * 24 * 365 * 4;

    //   await sdt.connect(dummyUser2).approve(veSDTProxy.address, parseEther("1"));
    //   await veSDTProxy.connect(dummyUser2).create_lock(parseEther("1"), lockTime);

    //   await sdt.connect(dummyUser3).approve(veSDTProxy.address, parseEther("1"));
    //   await veSDTProxy.connect(dummyUser3).create_lock(parseEther("1"), lockTime);

    //   let blockNum = await ethers.provider.getBlockNumber();
    //   let block = await ethers.provider.getBlock(blockNum);
    //   var time = block.timestamp;
    //   await veBoost
    //     .connect(dummyUser3)
    //     ["create_boost(address,address,int256,uint256,uint256,uint256)"](
    //       dummyUser3._address,
    //       dummyUser2._address,
    //       5_000,
    //       0,
    //       time + 86400 * 14,
    //       0
    //     );

    //   var sdtBefore = await sdt.balanceOf(DUMMYUSER2);
    //   var sdtBeforeNB = await sdt.balanceOf(DUMMYUSER3);
    //   var fxsBefore = await fxs.balanceOf(DUMMYUSER2);
    //   var fxsBeforeNB = await fxs.balanceOf(DUMMYUSER3);
    //   var sanUsdcEurBefore = await sanUsdcEur.balanceOf(DUMMYUSER2);
    //   var sanUsdcEurBeforeNB = await sanUsdcEur.balanceOf(DUMMYUSER3);

    //   // Adding FXS rewards
    //   await (await FXS1559_AMO_V3.connect(frax1).swapBurn(parseEther("100"), true)).wait();
    //   await surplusConverterSanTokens
    //     .connect(surplusCaller)
    //     ["buyback(address,uint256,uint256,bool)"](
    //       "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    //       "300000000000",
    //       "90000000000",
    //       true
    //     );

    //   await sanUsdcEur.connect(sanUsdcEurWhale).transfer(angleAccumulator.address, "100000000");

    //   await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 7]); // 1 week
    //   await network.provider.send("evm_mine", []);

    //   await fxsAccumulator.claimAndNotifyAll();
    //   await angleAccumulator.claimAndNotifyAll();

    //   await sdtDProxy.distributeMulti([fxsPPSGaugeProxy.address, anglePPSGaugeProxy.address]);

    //   await fxsPPSGaugeProxy.connect(dummyUser2)["claim_rewards()"]();
    //   await fxsPPSGaugeProxy.connect(dummyUser3)["claim_rewards()"]();
    //   await anglePPSGaugeProxy.connect(dummyUser2)["claim_rewards()"]();
    //   await anglePPSGaugeProxy.connect(dummyUser3)["claim_rewards()"]();

    //   var sdtAfter = await sdt.balanceOf(DUMMYUSER2);
    //   var sdtAfterNB = await sdt.balanceOf(DUMMYUSER3);
    //   var fxsAfter = await fxs.balanceOf(DUMMYUSER2);
    //   var fxsAfterNB = await fxs.balanceOf(DUMMYUSER3);
    //   var sanUsdcEurAfter = await sanUsdcEur.balanceOf(DUMMYUSER2);
    //   var sanUsdcEurAfterNB = await sanUsdcEur.balanceOf(DUMMYUSER3);

    //   expect(sdtAfter).gt(sdtBefore);
    //   expect(sdtAfterNB).gt(sdtBeforeNB);
    //   expect(fxsAfter).gt(fxsBefore);
    //   expect(fxsAfterNB).gt(fxsBeforeNB);
    //   expect(sanUsdcEurAfter).gt(sanUsdcEurBefore);
    //   expect(sanUsdcEurAfterNB).gt(sanUsdcEurBeforeNB);
    // });
  });
});

// because we could test the amount received in 3 different use cases:
// 1) User that stake sdFXS but does not hold any veSdT
// 2) User that stake sdFXS and hold veSDT without delegating any
// 2) User that stake sdFXS, hold veSDT, and delegated a part of them
