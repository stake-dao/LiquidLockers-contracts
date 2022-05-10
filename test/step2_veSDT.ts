import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const SDTWHALE = "0x48238Faf05BF8B745249dB3c26606A72149600B8";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const thousand = parseEther("1000");

const ONEWEEK = 7 * 86400;
const MAXDURATION = 4 * 365 * 86400;
const GRMAXDURATION = 5 * 365 * 86400;

describe("veSDT", () => {
  let locker: Contract;
  let whitelist: Contract;
  let sdt: Contract;
  let sdtWhaleSigner: JsonRpcSigner;
  let baseOwner: SignerWithAddress;
  var block: any;

  before(async function () {
    this.timeout(0);

    const [owner] = await ethers.getSigners();
    baseOwner = owner;

    sdt = await ethers.getContractAt(ERC20, SDT);
    sdtWhaleSigner = await ethers.provider.getSigner(SDTWHALE);

    await network.provider.send("hardhat_setBalance", [SDTWHALE, parseEther("10").toHexString()]);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDTWHALE]
    });

    await sdt.connect(sdtWhaleSigner).transfer(owner.getAddress(), parseEther("10000"));
  });

  async function InitializeLocker() {
    const [owner] = await ethers.getSigners();
    const Locker = await ethers.getContractFactory("veSDT");
    const Whitelist = await ethers.getContractFactory("SmartWalletWhitelist");

    locker = await Locker.deploy();
    whitelist = await Whitelist.deploy(owner.address);

    await locker.initialize(owner.address, sdt.address, whitelist.address, "Vote-escrowed SDT", "veSDT");
  }

  describe("Deposit", async () => {
    beforeEach(async () => {
      await InitializeLocker();
    });

    it("User should be able to lock SDT for a period", async () => {
      await sdt.approve(locker.address, thousand);
      const blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);
      var initialLockerBalance = await sdt.balanceOf(locker.address);
      var initialBalance = await sdt.balanceOf(baseOwner.address);
      await locker.create_lock(thousand, block.timestamp + ONEWEEK);
      var afterBalance = await sdt.balanceOf(baseOwner.address);
      var afterLockerBalance = await sdt.balanceOf(locker.address);
      var res = initialBalance.sub(afterBalance);

      expect(afterLockerBalance.sub(initialLockerBalance).toString() === thousand.toString()).equals(true, "error");
      expect(res.toString() === thousand.toString()).equals(true, "error");
    });

    it("User should be able to lock SDT on behalf of other user", async () => {
      await sdt.connect(sdtWhaleSigner).approve(locker.address, thousand);
      await locker.connect(sdtWhaleSigner).create_lock(thousand, block.timestamp + ONEWEEK);
      await sdt.connect(sdtWhaleSigner).approve(locker.address, thousand);

      var initialLockerBalance = await sdt.balanceOf(locker.address);
      var initialBalance = await sdt.balanceOf(SDTWHALE);
      await locker.deposit_for(SDTWHALE, thousand);
      var afterBalance = await sdt.balanceOf(SDTWHALE);
      var afterLockerBalance = await sdt.balanceOf(locker.address);

      expect(afterLockerBalance.sub(initialLockerBalance).toString() === thousand.toString()).equals(true, "error");
      expect(initialBalance.sub(afterBalance).toString() === thousand.toString()).equals(true, "error");
    });

    it("User should be able to lock SDT on behalf of other user and supply the SDT", async () => {
      await sdt.connect(sdtWhaleSigner).approve(locker.address, thousand);
      await locker.connect(sdtWhaleSigner).create_lock(thousand, block.timestamp + ONEWEEK);
      await sdt.connect(sdtWhaleSigner).approve(locker.address, thousand);
      var beforebalance = await sdt.balanceOf(baseOwner.address);
      var initialLockerBalance = await sdt.balanceOf(locker.address);
      await sdt.approve(locker.address, thousand);
      await locker.deposit_for_from(SDTWHALE, thousand);
      var afterbalance = await sdt.balanceOf(baseOwner.address);
      var afterLockerBalance = await sdt.balanceOf(locker.address);

      expect(beforebalance.sub(afterbalance)).to.equal(thousand);
      expect(afterLockerBalance.sub(initialLockerBalance).toString() === thousand.toString()).equals(true, "error");
    });

    it("User should be able to add more amount without changing the duration", async () => {
      await sdt.approve(locker.address, thousand);
      const blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);

      var initialBalance = await sdt.balanceOf(baseOwner.address);
      await locker.create_lock(thousand, block.timestamp + ONEWEEK);
      var afterBalance = await sdt.balanceOf(baseOwner.address);

      var res = initialBalance.sub(afterBalance);

      expect(res.toString() === thousand.toString()).equals(true, "error");

      await sdt.approve(locker.address, thousand);
      initialBalance = await sdt.balanceOf(baseOwner.address);
      var initialLockerBalance = await sdt.balanceOf(locker.address);
      await locker.increase_amount(thousand);
      afterBalance = await sdt.balanceOf(baseOwner.address);
      var afterLockerBalance = await sdt.balanceOf(locker.address);
      res = initialBalance.sub(afterBalance);

      expect(res.toString() === thousand.toString()).equals(true, "error");
      expect(afterLockerBalance.sub(initialLockerBalance).toString() === thousand.toString()).equals(true, "error");
    });
  });

  describe("Duration Testing", async () => {
    beforeEach(async () => {
      await InitializeLocker();
      await sdt.approve(locker.address, thousand);
    });

    it("User should be able to lock SDT for a period below max period", async () => {
      const blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);

      var initialBalance = await sdt.balanceOf(baseOwner.address);
      var initialLockerBalance = await sdt.balanceOf(locker.address);
      await locker.create_lock(thousand, block.timestamp + ONEWEEK);
      var afterBalance = await sdt.balanceOf(baseOwner.address);
      var afterLockerBalance = await sdt.balanceOf(locker.address);

      var res = initialBalance.sub(afterBalance);

      expect(res.toString() === thousand.toString()).equals(true, "error");
      expect(afterLockerBalance.sub(initialLockerBalance).toString() === thousand.toString()).equals(true, "error");
    });

    it("User should be able to lock SDT for the max period", async () => {
      const blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);
      var initialBalance = await sdt.balanceOf(baseOwner.address);
      var initialLockerBalance = await sdt.balanceOf(locker.address);
      await locker.create_lock(thousand, block.timestamp + MAXDURATION);
      var afterBalance = await sdt.balanceOf(baseOwner.address);
      var afterLockerBalance = await sdt.balanceOf(locker.address);

      var res = initialBalance.sub(afterBalance);

      expect(res.toString() === thousand.toString()).equals(true, "error");
      expect(afterLockerBalance.sub(initialLockerBalance).toString() === thousand.toString()).equals(true, "error");
    });

    it("User should not be able to lock SDT with a duration exceeding the max period", async () => {
      const blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);
      var initialBalance = await sdt.balanceOf(baseOwner.address);
      var initialLockerBalance = await sdt.balanceOf(locker.address);

      await expect(locker.create_lock(thousand, block.timestamp + GRMAXDURATION)).revertedWith(
        "Voting lock can be 4 years max"
      );
      var afterLockerBalance = await sdt.balanceOf(locker.address);
      var afterBalance = await sdt.balanceOf(baseOwner.address);

      var res = initialBalance.sub(afterBalance);

      expect(res.toString() === "0").equals(true, "error");
      expect(afterLockerBalance.toString() == initialLockerBalance.toString()).equals(true, "error");
    });

    it("User should be able to increase the duration of an existing lock", async () => {
      const blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);

      var initialBalance = await sdt.balanceOf(baseOwner.address);
      await locker.create_lock(thousand, block.timestamp + ONEWEEK);
      var afterBalance = await sdt.balanceOf(baseOwner.address);

      var res = initialBalance.sub(afterBalance);

      expect(res.toString() === thousand.toString()).equals(true, "error");

      await locker.increase_unlock_time(block.timestamp + 2 * ONEWEEK);
    });
  });

  describe("veSDT", () => {
    beforeEach(async () => {
      await InitializeLocker();
      await sdt.approve(locker.address, thousand);
    });

    it("User should get equivalent veSDT to the amount of token locked", async () => {
      await sdt.approve(locker.address, parseEther("2000"));
      await locker.create_lock(parseEther("2000"), block.timestamp + ONEWEEK);

      const { amount: veSDT } = await locker.locked(baseOwner.address);

      expect(veSDT).equals(parseEther("2000"));
    });
  });
});
