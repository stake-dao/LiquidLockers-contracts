import { ethers, network } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { parseEther, parseUnits } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import common from "mocha/lib/interfaces/common";

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

const FXS_DEPOSITOR = "0xFaF3740167B866b571465B063c6B3A71Ba9b6285";
const ANGLE_DEPOSITOR = "0x8A97e8B3389D431182aC67c0DF7D46FF8DCE7121";

const GAUGE_CONTROLLER = "0x75f8f7fa4b6DA6De9F4fE972c811b778cefce882";

const FXS_ACCUMULATOR = "0x1CC16bEdaaCD15848bcA5eB80188e0931bC59fB2";
const ANGLE_ACCUMULATOR = "0x9dDdf9c8a7447993bCfef18F6b5421f28bD1C888";

const SDFXS_GAUGE = "0xF3C6e8fbB946260e8c2a55d48a5e01C82fD63106";
const SDANGLE_GAUGE = "0xE55843a90672f7d8218285e51EE8fF8E233F35d5";

const PROXY_ADMIN = "0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B";

const ANGLE_DEPLOYER = "0xfdA462548Ce04282f4B6D6619823a7C64Fdc0185";
const ANGLE_FEE_D = "0x7F82ff050128e29Fd89D85d01b93246F744E62A0";

const SDT_DISTRIBUTOR = "0x06F66Bc79aeD1b49a393bF5fcF68a70499A2B5DC";
const CLAIM_REWARDS = "0xf30f23B7FB233172A41b32f82D263c33a0c9F8c2";

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
  let fxsPPSGaugeProxy: Contract;
  let anglePPSGaugeProxy: Contract;
  let proxyAdmin: Contract;
  let sww: Contract;
  let sdtDistributor: Contract;
  let sdtDProxy: Contract;
  let veBoostProxy: Contract;
  let masterchef: Contract;
  let fxsAccumulator: Contract;
  let angleAccumulator: Contract;
  let fxsLocker: Contract;
  let angleLocker: Contract;
  let fxs: Contract;
  let sanUsdcEur: Contract;
  let usdc: Contract;
  let claimRewards: Contract;
  let angleDepositor: Contract;
  let fxsDepositor: Contract;
  let angleFD: Contract;
  let timelock: JsonRpcSigner;
  let sdtWhaleSigner: JsonRpcSigner;
  let sdFXSWhaleSigner: JsonRpcSigner;
  let sdAngleWhaleSigner: JsonRpcSigner;
  let sdtDeployerSigner: JsonRpcSigner;
  let angleDeployerSigner: JsonRpcSigner;
  let deployer: SignerWithAddress;
  let dummyUser: JsonRpcSigner;
  let surplusCaller: JsonRpcSigner;
  let usdcWhale: JsonRpcSigner;
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
    fxsDepositor = await ethers.getContractAt("Depositor", FXS_DEPOSITOR);
    angleDepositor = await ethers.getContractAt("Depositor", ANGLE_DEPOSITOR);
    gc = await ethers.getContractAt("GaugeController", GAUGE_CONTROLLER);
    fxsAccumulator = await ethers.getContractAt("FxsAccumulator", FXS_ACCUMULATOR);
    angleAccumulator = await ethers.getContractAt("AngleAccumulator", ANGLE_ACCUMULATOR);
    proxyAdmin = await ethers.getContractAt("ProxyAdmin", PROXY_ADMIN);
    angleFD = await ethers.getContractAt("FeeDistributor", ANGLE_FEE_D);

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
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ANGLE_DEPLOYER]
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
    timelock = await ethers.provider.getSigner(TIMELOCK);
    dummyUser = await ethers.provider.getSigner(DUMMYUSER);
    surplusCaller = await ethers.provider.getSigner(SAN);
    sdtDeployerSigner = await ethers.provider.getSigner(SDT_DEPLOYER);
    usdcWhale = await ethers.provider.getSigner(USDCWHALE);
    angleDeployerSigner = await ethers.provider.getSigner(ANGLE_DEPLOYER);

    await network.provider.send("hardhat_setBalance", [sdtWhaleSigner._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [timelock._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [sdFXSWhaleSigner._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [sdAngleWhaleSigner._address, parseEther("10").toHexString()]);
    await network.provider.send("hardhat_setBalance", [dummyUser._address, parseEther("10").toHexString()]);

    // set lockers into accumulators
    await fxsAccumulator.connect(sdtDeployerSigner).setLocker(fxsLocker.address);
    await angleAccumulator.connect(sdtDeployerSigner).setLocker(angleLocker.address);

    claimRewards = await ethers.getContractAt("ClaimRewards", CLAIM_REWARDS);
    sdtDProxy = await ethers.getContractAt("SdtDistributor", SDT_DISTRIBUTOR);

    fxsPPSGaugeProxy = await ethers.getContractAt("LiquidityGaugeV4", SDFXS_GAUGE);
    anglePPSGaugeProxy = await ethers.getContractAt("LiquidityGaugeV4", SDANGLE_GAUGE);

    // set reward distributor
    await fxsPPSGaugeProxy.connect(sdtDeployerSigner).set_claimer(claimRewards.address);
    await anglePPSGaugeProxy.connect(sdtDeployerSigner).set_claimer(claimRewards.address);

    // set gauge into the accumulator
    await fxsAccumulator.connect(sdtDeployerSigner).setGauge(fxsPPSGaugeProxy.address);
    await angleAccumulator.connect(sdtDeployerSigner).setGauge(anglePPSGaugeProxy.address);

    // set gauges and depositors on claim reward contract
    await claimRewards.connect(sdtDeployerSigner).enableGauge(fxsPPSGaugeProxy.address);
    await claimRewards.connect(sdtDeployerSigner).enableGauge(anglePPSGaugeProxy.address);
    await claimRewards.connect(sdtDeployerSigner).addDepositor(fxs.address, fxsDepositor.address);
    await claimRewards.connect(sdtDeployerSigner).addDepositor(ANGLE, angleDepositor.address);

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
    await sdtDProxy.connect(sdtDeployerSigner).initializeMasterchef(pidSdtD);
    await sdtDProxy.connect(sdtDeployerSigner).setDistribution(true);

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

    await usdc.connect(usdcWhale).transfer(surplusCaller._address, "100000000000");
    await usdc.connect(usdcWhale).transfer("0x5addc89785d75c86ab939e9e15bfbbb7fc086a87", "100000000000");
    await usdc.connect(usdcWhale).transfer(BASESURPLUS, "300000000000");

    // call checkpoint token in angle fee distributor
    await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 2]);
    await network.provider.send("evm_mine", []);
    await angleFD.connect(angleDeployerSigner).checkpoint_token();
  });

  describe("Accumulator", async () => {
    it("should get the yield", async function() {
      this.enableTimeouts(false)
      await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 2]);
      await network.provider.send("evm_mine", []);
      await fxsAccumulator.claimAndNotifyAll();
      const fxsBalance = await fxs.balanceOf(fxsPPSGaugeProxy.address);
      console.log(fxsBalance.toString());
      expect(fxsBalance).gt(0);
      await angleAccumulator.claimAndNotifyAll();
      const sanLPBalance = await sanUsdcEur.balanceOf(anglePPSGaugeProxy.address);
      expect(sanLPBalance).gt(0);
      console.log(sanLPBalance.toString());
    });
  });
});