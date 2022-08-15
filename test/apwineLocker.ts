import { expect } from "chai";
import { ethers, network } from "hardhat";

import { parseEther } from "@ethersproject/units";
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { writeBalance } from "./utils";
import ERC20ABI from "./fixtures/ERC20.json";

import {
  SDT,
  SDT_DISTRIBUTOR,
  VE_SDT,
  VE_SDT_BOOST_PROXY,
  APW,
  APWINE_FEE_DISTRIBUTOR,
  VEAPW,
  APWINE_SMART_WALLET_CHECKER,
  APWINE_DAO
} from "./constant";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();
const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};
describe("Apwine Locker tests", () => {
  let apwineLocker: Contract;
  let apwineDepositor: Contract;
  let apwineAccumulator: Contract;
  let sdAPW: Contract;
  let liquidityGauge: Contract;
  let localDeployer: SignerWithAddress;
  let apwineDao: JsonRpcSigner;
  let depositor: SignerWithAddress;
  let apw: Contract;
  let proxyAdmin: Contract;
  let apwineSmartWalletChecker: Contract;
  before(async () => {
    [localDeployer, depositor] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [APWINE_DAO]
    });
    apwineDao = await ethers.provider.getSigner(APWINE_DAO);
    await network.provider.send("hardhat_setBalance", [APWINE_DAO, ETH_100]);
    ///FACTORIES
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGaugeV4");
    const apwineAccumulatorFactory = await ethers.getContractFactory("ApwineAccumulator");
    const apwineLockerFactory = await ethers.getContractFactory("ApwineLocker");
    const sdTokenFactory = await ethers.getContractFactory("sdToken");
    const apwDepositorFactory = await ethers.getContractFactory("ApwineDepositor");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");

    sdAPW = await sdTokenFactory.deploy("Stake DAO APW", "sdAPW");
    const liquidityGaugeImpl = await LiquidityGauge.deploy();
    let ABI_LGV4 = [
      "function initialize(address _staking_token, address _admin, address _SDT, address _voting_escrow, address _veBoost_proxy, address _distributor)"
    ];
    let iface_gv4 = new ethers.utils.Interface(ABI_LGV4);
    const dataApwGauge = iface_gv4.encodeFunctionData("initialize", [
      sdAPW.address,
      localDeployer.address,
      SDT,
      VE_SDT,
      VE_SDT_BOOST_PROXY,
      SDT_DISTRIBUTOR
    ]);
    proxyAdmin = await ProxyAdmin.deploy();
    liquidityGauge = await Proxy.deploy(liquidityGaugeImpl.address, proxyAdmin.address, dataApwGauge);
    apwineAccumulator = await apwineAccumulatorFactory.deploy(APW, liquidityGauge.address);
    apwineLocker = await apwineLockerFactory.deploy(apwineAccumulator.address);
    apwineSmartWalletChecker = await ethers.getContractAt("SmartWalletWhitelist", APWINE_SMART_WALLET_CHECKER);
    await apwineSmartWalletChecker.connect(apwineDao).approveWallet(apwineLocker.address);
    await writeBalance(APW, "1000000", depositor.address);
    apw = await ethers.getContractAt(ERC20ABI, APW);
    apw.connect(depositor).transfer(apwineLocker.address, ethers.utils.parseEther("10"));

    const timestampNow = await getNow();
    const oneYear = 60 * 60 * 24 * 365 * 2;
    await apwineLocker.createLock(ethers.utils.parseEther("10"), timestampNow + oneYear);
    apwineDepositor = await apwDepositorFactory.deploy(APW, apwineLocker.address, sdAPW.address, VEAPW);
    await apwineLocker.setApwDepositor(apwineDepositor.address);

    await sdAPW.setOperator(apwineDepositor.address);
  });

  it("it should be able to deposit apw to depositor", async () => {
    const sdApwBalanceBeforeDeposit = await sdAPW.balanceOf(depositor.address);
    const depositAmount = ethers.utils.parseEther("10000");
    await apw.connect(depositor).approve(apwineDepositor.address, ethers.constants.MaxUint256);
    await apwineDepositor.connect(depositor).deposit(depositAmount, true, false, depositor.address);
    const sdApwBalanceAfterDeposit = await sdAPW.balanceOf(depositor.address);
    expect(sdApwBalanceBeforeDeposit).to.be.eq(0);
    expect(sdApwBalanceAfterDeposit).to.be.equal(depositAmount);
  });
});
