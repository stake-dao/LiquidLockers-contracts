import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20ABI from "./fixtures/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import WalletCheckerABI from "./fixtures/WalletChecker.json";

const FXS = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0";
const WALLET_CHECKER = "0x53c13BA8834a1567474b19822aAD85c6F90D9f9F";
const WALLET_CHECKER_OWNER = "0xb1748c79709f4ba2dd82834b8c82d4a505003f27";
const FXS_HOLDER = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
const ACC = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // StakeDAO multisig

const DAY = 86400;
const ONEWEEK = 7 * DAY;
const MAXDURATION = 4 * 365 * DAY;
const GRMAXDURATION = 5 * 365 * DAY;

const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

describe("Edge cases", () => {
  let locker: Contract;
  let fxs: Contract;
  let fxsHolder: JsonRpcSigner;
  let walletCheckerOwner: JsonRpcSigner;
  let baseOwner: SignerWithAddress;
  let secondAccount: SignerWithAddress;
  let sdFXSToken: Contract;
  let fxsDepositor: Contract;
  let walletChecker: Contract;

  before(async function () {
    this.enableTimeouts(false);
    await network.provider.send("evm_setAutomine", [true]);
    const temp = await ethers.getSigners();

    baseOwner = temp[0];
    secondAccount = temp[1];

    fxsHolder = ethers.provider.getSigner(FXS_HOLDER);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FXS_HOLDER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WALLET_CHECKER_OWNER]
    });

    const SdFXSToken = await ethers.getContractFactory("sdFXSToken");
    const FxsDepositor = await ethers.getContractFactory("FxsDepositor");
    const FxsLocker = await ethers.getContractFactory("FxsLocker");

    sdFXSToken = await SdFXSToken.deploy("Stake DAO FXS", "sdFXS");
    locker = await FxsLocker.deploy(ACC);
    fxsDepositor = await FxsDepositor.deploy(FXS, locker.address, sdFXSToken.address);
    walletChecker = await ethers.getContractAt(WalletCheckerABI, WALLET_CHECKER);
    walletCheckerOwner = ethers.provider.getSigner(WALLET_CHECKER_OWNER);
    fxs = await ethers.getContractAt(ERC20ABI, FXS);

    await sdFXSToken.setOperator(fxsDepositor.address);
    await walletChecker.connect(walletCheckerOwner).approveWallet(locker.address);

    const lockingAmount = parseEther("1");

    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);
    var time = block.timestamp;
    const lockEnd = time + ONE_YEAR_IN_SECONDS * 4;

    await locker.setFxsDepositor(fxsDepositor.address);
    await fxs.connect(fxsHolder).transfer(locker.address, lockingAmount);
    await locker.createLock(lockingAmount, lockEnd);
    await fxs.connect(fxsHolder).approve(fxsDepositor.address, lockingAmount);
  });

  describe("Edge Cases", async () => {
    it("Unable to deposit FXS if the operator has been changed", async () => {
      await fxsDepositor.setSdFXSOperator(secondAccount.address);
      const lockingAmount = parseEther("1");
      await fxs.connect(fxsHolder).approve(fxsDepositor.address, lockingAmount);
      await expect(fxsDepositor.connect(fxsHolder).deposit(lockingAmount, false)).to.be.revertedWith("!authorized");
      await sdFXSToken.connect(secondAccount).setOperator(fxsDepositor.address);
    });
  });
});
