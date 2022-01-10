import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20ABI from "./fixtures/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import WalletCheckerABI from "./fixtures/WalletChecker.json";

const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const SDT_HOLDER = "0xce9560a2f39A4a54b99965110Dd0C80b39EcC655";
const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const WALLET_CHECKER = "0x53c13BA8834a1567474b19822aAD85c6F90D9f9F";
const WALLET_CHECKER_OWNER = "0xb1748c79709f4ba2dd82834b8c82d4a505003f27";
const FXS_HOLDER = "0xF977814e90dA44bFA03b6295A0616a897441aceC";

const DAY = 86400;
const ONEWEEK = 7 * DAY;
const MAXDURATION = 4 * 365 * DAY;
const GRMAXDURATION = 5 * 365 * DAY;

const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

describe("Edge cases", () => {
  let locker: Contract;
  let gaugeMultiRewardsPPS: Contract;
  let fxs: Contract;
  let sdt: Contract;
  let veSDT: Contract;
  let fxsHolder: JsonRpcSigner;
  let sdtHolder: JsonRpcSigner;
  let walletCheckerOwner: JsonRpcSigner;
  let baseOwner: SignerWithAddress;
  let secondAccount: SignerWithAddress;
  let sdFXSToken: Contract;
  let fxsDepositor: Contract;
  let accumulator: Contract;
  let walletChecker: Contract;
  let claimContract: Contract;

  before(async function () {
    this.enableTimeouts(false);
    await network.provider.send("evm_setAutomine", [true]);
    const temp = await ethers.getSigners();

    baseOwner = temp[0];
    secondAccount = temp[1];

    fxsHolder = ethers.provider.getSigner(FXS_HOLDER);
    sdtHolder = ethers.provider.getSigner(SDT_HOLDER);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FXS_HOLDER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDT_HOLDER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WALLET_CHECKER_OWNER]
    });

    const SdFXSToken = await ethers.getContractFactory("sdFXSToken");
    const FxsDepositor = await ethers.getContractFactory("FxsDepositor");
    const FraxLocker = await ethers.getContractFactory("FraxLocker");
    const FXSAccumulator = await ethers.getContractFactory("FXSAccumulator");
    const GaugeMultiRewardsPPS = await ethers.getContractFactory("GaugeMultiRewards");
    const VeSDT = await ethers.getContractFactory("veSDT");
    const ClaimContract = await ethers.getContractFactory("ClaimContract");

    sdFXSToken = await SdFXSToken.deploy();
    accumulator = await FXSAccumulator.deploy();
    locker = await FraxLocker.deploy(accumulator.address);
    fxsDepositor = await FxsDepositor.deploy(locker.address, sdFXSToken.address);
    veSDT = await VeSDT.deploy(SDT, "Voting Escrow SDT", "veSDT", "v1.0.0");
    gaugeMultiRewardsPPS = await GaugeMultiRewardsPPS.deploy(sdFXSToken.address, SDT, veSDT.address);
    walletChecker = await ethers.getContractAt(WalletCheckerABI, WALLET_CHECKER);
    walletCheckerOwner = ethers.provider.getSigner(WALLET_CHECKER_OWNER);
    fxs = await ethers.getContractAt(ERC20ABI, FXS);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    claimContract = await ClaimContract.deploy();

    await accumulator.setLocker(locker.address);
    await accumulator.setGauge(gaugeMultiRewardsPPS.address);
    await sdFXSToken.setOperator(fxsDepositor.address);
    await walletChecker.connect(walletCheckerOwner).approveWallet(locker.address);  

    const lockingAmount = parseEther("1");

    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);
    var time = block.timestamp;
    const lockEnd = time + ONE_YEAR_IN_SECONDS * 3;

    await locker.setFxsDepositor(fxsDepositor.address);
    await fxs.connect(fxsHolder).transfer(locker.address, lockingAmount);
    await locker.createLock(lockingAmount, lockEnd);
    await fxsDepositor.setGauge(gaugeMultiRewardsPPS.address);
    await fxs.connect(fxsHolder).approve(fxsDepositor.address, lockingAmount);

    await gaugeMultiRewardsPPS.addReward(FXS, accumulator.address, 604800 * 4);
    await gaugeMultiRewardsPPS.setClaimContract(claimContract.address);
  });

  describe("Edge Cases", async () => {
    it("Unable to deposit FXS and stake the sdFXS into the gauge if the veSDT balance is 0", async () => {
      const lockingAmount = parseEther("1");
      await expect(fxsDepositor.connect(fxsHolder).deposit(lockingAmount, true, true)).to.be.revertedWith("SafeMath: division by zero");
      await sdt.connect(sdtHolder).approve(veSDT.address, lockingAmount);
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      await veSDT.connect(sdtHolder).create_lock(lockingAmount, block.timestamp + ONEWEEK * 3)
      await fxsDepositor.connect(fxsHolder).deposit(lockingAmount, true, true);
    });

    it("Unable to deposit FXS if the operator has been changed", async () => {
      await fxsDepositor.setSdFXSOperator(secondAccount.address);
      const lockingAmount = parseEther("1");
      await fxs.connect(fxsHolder).approve(fxsDepositor.address, lockingAmount);
      await expect(fxsDepositor.connect(fxsHolder).deposit(lockingAmount, false, false)).to.be.revertedWith("!authorized");
      await sdFXSToken.connect(secondAccount).setOperator(fxsDepositor.address);
    });

    it("Unable to receive FXS from the gauge if the FXS address was not passed as extra token", async () => {
      const fxsToSend = parseEther("500");
      await fxs.connect(fxsHolder).transfer(accumulator.address, fxsToSend);
      await accumulator.claimAndNotify();
      await network.provider.send("evm_increaseTime", [604800]); // 1 week
      await network.provider.send("evm_mine", []);
      var locks: any[] = [
        { locked: [true], tokens: [FXS] }
      ];
      const balanceBefore = await fxs.balanceOf(fxsHolder._address);
      await claimContract.connect(fxsHolder).claimAndLock([gaugeMultiRewardsPPS.address], locks, []);
      const balanceAfter = await fxs.balanceOf(fxsHolder._address);
      expect(balanceAfter).to.be.eq(balanceBefore);
      const claimFXSBalance = await fxs.balanceOf(claimContract.address);
      expect(claimFXSBalance).to.be.gt(0);
    });
  });
});