import { expect } from "chai";
import { ethers, network } from "hardhat";

import { parseEther } from "@ethersproject/units";
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { writeBalance, skip } from "./utils";
import ERC20ABI from "./fixtures/ERC20.json";

import {
  SDT,
  SDT_DISTRIBUTOR,
  VE_SDT,
  VE_SDT_BOOST_PROXY,
  BPT,
  BPT_FEE_DISTRIBUTOR,
  VEBPT,
  BPT_SMART_WALLET_CHECKER,
  BPT_DAO,
  WETH
} from "./constant";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();
const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};
const toBytes32 = (bn: BigNumber) => {
  return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
};
describe("Apwine Locker tests", () => {
  let blackpoolLocker: Contract;
  let blackpoolDepositor: Contract;
  let blackpoolAccumulator: Contract;
  let sdBPT: Contract;
  let liquidityGauge: Contract;
  let localDeployer: SignerWithAddress;
  let blackpoolDao: JsonRpcSigner;
  let depositor: SignerWithAddress;
  let feeReceiver: SignerWithAddress;
  let bpt: Contract;
  let proxyAdmin: Contract;
  let blackpoolSmartWalletChecker: Contract;
  let veBpt: Contract;
  let weth: Contract;
  before(async () => {
    [localDeployer, depositor, feeReceiver] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BPT_DAO]
    });
    blackpoolDao = await ethers.provider.getSigner(BPT_DAO);
    await network.provider.send("hardhat_setBalance", [BPT_DAO, ETH_100]);
    ///FACTORIES
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGaugeV4");
    const blackpoolAccumulatorFactory = await ethers.getContractFactory("BlackpoolAccumulator");
    const blackpoolLockerFactory = await ethers.getContractFactory("BlackpoolLocker");
    const sdTokenFactory = await ethers.getContractFactory("sdToken");
    const bptDepositorFactory = await ethers.getContractFactory("BlackpoolDepositor");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");

    sdBPT = await sdTokenFactory.deploy("Stake DAO BPT", "sdBPT");
    const liquidityGaugeImpl = await LiquidityGauge.deploy();
    let ABI_LGV4 = [
      "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
    ];
    let iface_gv4 = new ethers.utils.Interface(ABI_LGV4);
    const dataApwGauge = iface_gv4.encodeFunctionData("initialize", [
      sdBPT.address,
      localDeployer.address,
      SDT,
      VE_SDT,
      VE_SDT_BOOST_PROXY,
      SDT_DISTRIBUTOR
    ]);
    proxyAdmin = await ProxyAdmin.deploy();
    liquidityGauge = await Proxy.deploy(liquidityGaugeImpl.address, proxyAdmin.address, dataApwGauge);
    liquidityGauge = await ethers.getContractAt("LiquidityGaugeV4", liquidityGauge.address);
    blackpoolAccumulator = await blackpoolAccumulatorFactory.deploy(WETH, liquidityGauge.address);
    blackpoolLocker = await blackpoolLockerFactory.deploy(blackpoolAccumulator.address);
    blackpoolSmartWalletChecker = await ethers.getContractAt("SmartWalletWhitelist", BPT_SMART_WALLET_CHECKER);
    await blackpoolSmartWalletChecker.connect(blackpoolDao).approveWallet(blackpoolLocker.address);
    await writeBalance(WETH, "1000000", depositor.address);
    await writeBalance(BPT, "1000000", depositor.address);
    bpt = await ethers.getContractAt(ERC20ABI, BPT);
    bpt.connect(depositor).transfer(blackpoolLocker.address, ethers.utils.parseEther("10"));

    const timestampNow = await getNow();
    const twoYear = 60 * 60 * 24 * 365 * 2;
    await blackpoolLocker.createLock(ethers.utils.parseEther("10"), timestampNow + twoYear);
    blackpoolDepositor = await bptDepositorFactory.deploy(BPT, blackpoolLocker.address, sdBPT.address, VEBPT);
    await blackpoolLocker.setBptDepositor(blackpoolDepositor.address);

    await sdBPT.setOperator(blackpoolDepositor.address);
    await blackpoolDepositor.setGauge(liquidityGauge.address);
    await blackpoolAccumulator.setLocker(blackpoolLocker.address);
    await liquidityGauge.add_reward(WETH, blackpoolAccumulator.address);
    veBpt = await ethers.getContractAt("VeToken", VEBPT);
    weth = await ethers.getContractAt("ERC20", WETH);
  });

  it("it should be able to lock BPT through locker", async () => {
    const sdApwBalanceBeforeDeposit = await sdBPT.balanceOf(depositor.address);
    const depositAmount = ethers.utils.parseEther("10000");
    await bpt.connect(depositor).approve(blackpoolDepositor.address, ethers.constants.MaxUint256);
    await blackpoolDepositor.connect(depositor).deposit(depositAmount, true, true, depositor.address);
    const gaugeBalanceAfterDeposit = await liquidityGauge.balanceOf(depositor.address);
    expect(sdApwBalanceBeforeDeposit).to.be.eq(0);
    expect(gaugeBalanceAfterDeposit).to.be.equal(depositAmount);
  });
  it("Accumulator should distribute rewards after some time passes", async () => {
    await weth.connect(depositor).transfer(BPT_FEE_DISTRIBUTOR, ethers.utils.parseEther("100")); // mock the weekly BPT rewards
    await skip(60 * 60 * 24 * 20); // extend 25 days
    const gaugeApwBalanceBefore = await weth.balanceOf(liquidityGauge.address);
    await blackpoolAccumulator.claimAndNotifyAll();
    const gaugeApwBalanceAfter = await weth.balanceOf(liquidityGauge.address);
    expect(gaugeApwBalanceBefore).to.be.eq(0);
    expect(gaugeApwBalanceAfter).to.be.gt(0);
  });
  it("It should increase lock time with new deposit", async () => {
    const depositAmount = ethers.utils.parseEther("10000");
    const unlockTimeBefore = await veBpt.locked__end(blackpoolLocker.address);
    await blackpoolDepositor.connect(depositor).deposit(depositAmount, true, true, depositor.address);
    const unlockTimeAfter = await veBpt.locked__end(blackpoolLocker.address);
    expect(unlockTimeAfter).to.be.gt(unlockTimeBefore);
  });
  it("it should cut fee over locker earnings", async () => {
    await blackpoolAccumulator.setLockerFee(1000);
    await blackpoolAccumulator.setFeeReceiver(feeReceiver.address);

    await weth.connect(depositor).transfer(BPT_FEE_DISTRIBUTOR, ethers.utils.parseEther("100")); // mock the weekly BPT rewards
    await skip(60 * 60 * 24 * 20); // extend 25 days
    const feeReceiverApwBalanceBefore = await weth.balanceOf(feeReceiver.address);
    await blackpoolAccumulator.claimAndNotifyAll();
    const feeReceiverApwBalanceAfter = await weth.balanceOf(feeReceiver.address);
    expect(feeReceiverApwBalanceBefore).to.be.eq(0);
    expect(feeReceiverApwBalanceAfter).to.be.gt(0);
  });
});
