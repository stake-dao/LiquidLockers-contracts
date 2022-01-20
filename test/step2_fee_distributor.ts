import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deepStrictEqual } from "assert";

const SDTWHALE = "0x4fcadc644a6868f9c8890a1a978810d89512a2e2";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const SD3CRVWHALE = "0xb477352e20807dfa1038b1ecfe5b5ad740ac7b82";
const SD3CRV = "0xB17640796e4c27a39AF51887aff3F8DC0daF9567";
const DEPLOYER = "0xb36a0671B3D49587236d7833B01E79798175875f";
const thousand = parseEther("1000");

const DAY = 86400;
const ONEWEEK = 7 * DAY;
const MAXDURATION = 4 * 365 * DAY;
const GRMAXDURATION = 5 * 365 * DAY;

describe("Fee distributor", () => {
  let locker: Contract;
  let whitelist: Contract;
  let distributor: Contract;
  let sdt: Contract;
  let sd3CRV: Contract;
  let sdtWhaleSigner: JsonRpcSigner;
  let sd3CRVWhaleSigner: JsonRpcSigner;
  let deployerSigner: JsonRpcSigner;
  let baseOwner: SignerWithAddress;
  let secondAccount: SignerWithAddress;
  var block: any;

  before(async function () {
    this.enableTimeouts(false);
    await network.provider.send("evm_setAutomine", [true]);
    const temp = await ethers.getSigners();

    baseOwner = temp[0];
    secondAccount = temp[1];
    sdt = await ethers.getContractAt(ERC20, SDT);
    sd3CRV = await ethers.getContractAt(ERC20, SD3CRV);
    sdtWhaleSigner = await ethers.provider.getSigner(SDTWHALE);
    sd3CRVWhaleSigner = await ethers.provider.getSigner(SD3CRVWHALE);
    deployerSigner = await ethers.provider.getSigner(DEPLOYER);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDTWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SD3CRVWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEPLOYER]
    });

    await baseOwner.sendTransaction({
      to: sdtWhaleSigner.getAddress(),
      value: ethers.utils.parseEther("100") // 1 ether
    });

    await baseOwner.sendTransaction({
      to: sd3CRVWhaleSigner.getAddress(),
      value: ethers.utils.parseEther("100") // 1 ether
    });

    await sdt.connect(sdtWhaleSigner).transfer(baseOwner.getAddress(), parseEther("10000"));
    await sdt.connect(sdtWhaleSigner).transfer(secondAccount.getAddress(), parseEther("10000"));
    await sd3CRV.connect(sd3CRVWhaleSigner).transfer(baseOwner.address, parseEther("1000"));
  });

  async function InitializeLocker() {
    const [owner] = await ethers.getSigners();
    const Locker = await ethers.getContractFactory("veSDT");
    const Whitelist = await ethers.getContractFactory("SmartWalletWhitelist");

    locker = await Locker.deploy();
    whitelist = await Whitelist.deploy(owner.address);

    await locker.initialize(owner.address, sdt.address, whitelist.address, "Vote-escrowed SDT", "veSDT");
  }
  async function InitializeDistributor() {
    const blockNum = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNum);
    var time = block.timestamp;

    const Distri = await ethers.getContractFactory("FeeDistributor");
    distributor = await Distri.deploy(locker.address, time, SD3CRV, baseOwner.address, DEPLOYER);
  }

  async function TimePrint() {
    const blockNum = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNum);
    // console.log(block.timestamp)
  }

  describe("Claim", async () => {
    it("Claim: User locks after fee is added", async () => {
      await InitializeLocker();
      await InitializeDistributor();
      await sdt.connect(baseOwner).approve(locker.address, thousand);

      await sd3CRV.connect(baseOwner).transfer(distributor.address, parseEther("10"));
      // await distributor.checkpoint_token();
      // await distributor.checkpoint_total_supply();
      // await ethers.provider.send("evm_increaseTime", [DAY]);
      // await ethers.provider.send("evm_mine", []);

      await ethers.provider.send("evm_increaseTime", [ONEWEEK]);
      await ethers.provider.send("evm_mine", []);

      var blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);
      await locker.connect(baseOwner).create_lock(thousand, block.timestamp + 3 * ONEWEEK);

      await ethers.provider.send("evm_increaseTime", [5 * ONEWEEK]);
      await ethers.provider.send("evm_mine", []);

      // await distributor.checkpoint_token();
      // await distributor.checkpoint_total_supply();
      expect(await sd3CRV.balanceOf(baseOwner.address)).equals(parseEther("990"));
      await distributor.connect(baseOwner)["claim()"]();

      expect(await sd3CRV.balanceOf(baseOwner.address)).equals(parseEther("990")); //Same as before balance
    });

    it("Claim: User locks during fee deposit", async () => {
      await InitializeLocker();
      await sdt.connect(secondAccount).approve(locker.address, thousand);

      await ethers.provider.send("evm_increaseTime", [ONEWEEK]);
      await ethers.provider.send("evm_mine", []);
      await TimePrint();
      await locker.connect(secondAccount).create_lock(thousand, block.timestamp + 8 * ONEWEEK);
      await ethers.provider.send("evm_increaseTime", [ONEWEEK]);
      await ethers.provider.send("evm_mine", []);
      await InitializeDistributor();

      for (let index = 0; index < 3; index++) {
        for (let j = 0; j < 7; j++) {
          await sd3CRV.connect(baseOwner).transfer(distributor.address, parseEther("1"));
          await distributor.checkpoint_token();
          await distributor.checkpoint_total_supply();
          await ethers.provider.send("evm_increaseTime", [DAY]);
          await ethers.provider.send("evm_mine", []);
        }
      }

      await ethers.provider.send("evm_increaseTime", [ONEWEEK]);
      await ethers.provider.send("evm_mine", []);

      await distributor.checkpoint_token();
      await distributor.checkpoint_total_supply();
      let beforeBalance = await sd3CRV.balanceOf(secondAccount.address);
      await distributor.connect(secondAccount)["claim()"]();
      let afterBalance = await sd3CRV.balanceOf(secondAccount.address);
      expect(afterBalance.sub(beforeBalance)).to.be.lt(parseEther("21"));
    });

    it("Claim: User locks before fee is added", async () => {
      await TimePrint();
      await InitializeLocker();

      await sdt.connect(secondAccount).approve(locker.address, thousand);
      await locker.connect(secondAccount).create_lock(thousand, block.timestamp + 8 * ONEWEEK);
      await ethers.provider.send("evm_increaseTime", [ONEWEEK]);
      await ethers.provider.send("evm_mine", []);

      const blockNum = await ethers.provider.getBlockNumber();
      block = await ethers.provider.getBlock(blockNum);
      var time = block.timestamp;

      await ethers.provider.send("evm_increaseTime", [5 * ONEWEEK]);
      await ethers.provider.send("evm_mine", []);

      const Distri = await ethers.getContractFactory("FeeDistributor");
      distributor = await Distri.deploy(locker.address, time, SD3CRV, baseOwner.address, DEPLOYER);

      await sd3CRV.connect(baseOwner).transfer(distributor.address, parseEther("10"));
      await distributor.checkpoint_token();
      await ethers.provider.send("evm_increaseTime", [ONEWEEK]);
      await ethers.provider.send("evm_mine", []);
      await distributor.checkpoint_token();

      let beforeBalance = await sd3CRV.balanceOf(secondAccount.address);
      await distributor.connect(secondAccount)["claim()"]();
      let afterBalance = await sd3CRV.balanceOf(secondAccount.address);
      expect(afterBalance.sub(beforeBalance)).to.be.lt(parseEther("10"));
    });
  });

  describe("Safety checks", () => {
    it("Kill check", async () => {
      await InitializeLocker();
      await InitializeDistributor();
      await sd3CRV.connect(baseOwner).transfer(distributor.address, parseEther("10"));

      var beforeBalance = await sd3CRV.balanceOf(DEPLOYER);

      await distributor.connect(baseOwner).kill_me();
      var afterBalance = await sd3CRV.balanceOf(DEPLOYER);
      expect(afterBalance.sub(beforeBalance).toHexString() == parseEther("10").toHexString()).equals(true, "error");
    });

    it("Recovery", async () => {
      await InitializeLocker();
      await InitializeDistributor();
      await sdt.connect(baseOwner).transfer(distributor.address, parseEther("10"));

      var beforeBalance = await sdt.balanceOf(DEPLOYER);

      await distributor.connect(baseOwner).recover_balance(SDT);
      var afterBalance = await sdt.balanceOf(DEPLOYER);
      expect(afterBalance.sub(beforeBalance).toHexString() == parseEther("10").toHexString()).equals(true, "error");
    });
  });
});
