import { ethers, network } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

const SDTWHALE = "0x48238Faf05BF8B745249dB3c26606A72149600B8";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VESDTP = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const FXS_GAUGE_PPS = "0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8"; // random for now
const ANGLE_GAUGE_PPS = "0x1aD91ee08f21bE3dE0BA2ba6918E714dA6B45836"; // random for now

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("veSDT voting", () => {
  let sdt: Contract;
  let veSDTProxy: Contract;
  let gc: Contract;
  let sdtWhaleSigner: JsonRpcSigner;
  let deployer: SignerWithAddress;

  before(async function () {
    this.enableTimeouts(false);

    [deployer] = await ethers.getSigners();

    sdt = await ethers.getContractAt(ERC20, SDT);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDTWHALE]
    });

    sdtWhaleSigner = await ethers.provider.getSigner(SDTWHALE);
    await network.provider.send("hardhat_setBalance", [sdtWhaleSigner._address, parseEther("10").toHexString()]);

    const GaugeController = await ethers.getContractFactory("GaugeController");

    veSDTProxy = await ethers.getContractAt("veSDT", VESDTP);
    gc = await GaugeController.connect(deployer).deploy(sdt.address, veSDTProxy.address, deployer.address);

    // Add gauge types
    await gc.connect(deployer)["add_type(string,uint256)"]("Mainnet staking", parseEther("1")); // 0

    // add FXS and ANGLE gauges into gaugeController
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](FXS_GAUGE_PPS, 0, 0);
    await gc.connect(deployer)["add_gauge(address,int128,uint256)"](ANGLE_GAUGE_PPS, 0, 0);

    // Lock SDT for 4 years
    const sdtToLock = parseEther("10");
    const unlockTime = 60 * 60 * 24 * 365 * 4; // 4 years
    await sdt.connect(sdtWhaleSigner).approve(veSDTProxy.address, sdtToLock);
    await veSDTProxy.connect(sdtWhaleSigner).create_lock(sdtToLock, await getNow() + unlockTime);
  });

  describe("voting", async () => {
    it("should vote for a gauge", async () => {
      const wholePercent = 10000;
      const veSDTBalance = await veSDTProxy["balanceOf(address)"](sdtWhaleSigner._address);
      // vote
      await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(ANGLE_GAUGE_PPS, wholePercent / 2);
      await gc.connect(sdtWhaleSigner).vote_for_gauge_weights(FXS_GAUGE_PPS, wholePercent / 2 );
      // check vote correctness
      const angleGW = await gc.get_gauge_weight(ANGLE_GAUGE_PPS);
      const fxsGW = await gc.get_gauge_weight(FXS_GAUGE_PPS);
      expect(angleGW).to.be.eq(fxsGW);
    });
  });
});