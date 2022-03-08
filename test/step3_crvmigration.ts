import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20ABI from "./fixtures/ERC20.json";
import VECRVABI from "./fixtures/veCRV.json";
import WalletCheckerABI from "./fixtures/WalletChecker.json";
import VeFXSABI from "./fixtures/veFXS.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";

const SDVECRVWHALE1 = "0xb0e83c2d71a991017e0116d58c5765abc57384af";
const SDVECRVWHALE2 = "0xddb50ffdba4d89354e1088e4ea402de895562173";
const CRVWHALE = "0x7a16ff8270133f063aab6c9977183d9e72835428";
const DAO = "0x2d95A6D0ee4cD129f8f0b0ec91961D51Fb33fFd6";
const CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52";
const SDVECRV = "0x478bBC744811eE8310B461514BDc29D03739084D";
const VECRV = "0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2";
const OLD_LOCKER = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";

const ACC = "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"; // StakeDAO multisig
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";

describe("CRV Migration", function () {
  let sdVeCrvWhale1: JsonRpcSigner;
  let sdVeCrvWhale2: JsonRpcSigner;
  let crvWhale: JsonRpcSigner;
  let deployer: SignerWithAddress;
  let crvDepositor: Contract;
  let crv: Contract;
  let sdCRVToken: Contract;
  let sdVeCrv: Contract;
  let veCrv: Contract;
  let liquidityGauge: Contract;

  before(async function () {
    this.enableTimeouts(false);
    [deployer] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDVECRVWHALE1]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDVECRVWHALE2]
    });
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [CRVWHALE]
      });

    sdVeCrvWhale1 = ethers.provider.getSigner(SDVECRVWHALE1);
    sdVeCrvWhale2 = ethers.provider.getSigner(SDVECRVWHALE2);
    crvWhale = ethers.provider.getSigner(CRVWHALE);
    crv = await ethers.getContractAt(ERC20ABI, CRV);
    sdVeCrv = await ethers.getContractAt(ERC20ABI, SDVECRV);
    veCrv = await ethers.getContractAt(VECRVABI, VECRV);
    const SdCRVToken = await ethers.getContractFactory("sdCRV");
    sdCRVToken = await SdCRVToken.deploy("Stake DAO CRV", "sdCRV");

    const CrvDepositor = await ethers.getContractFactory("CrvDepositor");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGaugeV4");
    const VeBoostProxy = await ethers.getContractFactory("veBoostProxy");

    crvDepositor = await CrvDepositor.deploy(crv.address, OLD_LOCKER, sdCRVToken.address);
    liquidityGauge = await LiquidityGauge.deploy();
    
    const RANDOM = "0x478bBC744811eE8310B461514BDc29D03739084D";
    const VESDTP = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
    const veSDTProxy = await ethers.getContractAt("veSDT", VESDTP);
    const veBoostProxy = await VeBoostProxy.deploy(
      veSDTProxy.address,
      "0x0000000000000000000000000000000000000000",
      deployer.address
    );

    // await liquidityGauge.initialize(sdCRVToken.address, ACC, SDT, veSDTProxy.address, veBoostProxy.address, RANDOM);
    // await crvDepositor.setGauge(liquidityGauge.address);

    await sdCRVToken.setOperator(crvDepositor.address);
  });

  it("the balance sdCRV should be minted to DAO", async function () {
    const balance = await sdVeCrv.totalSupply();
    var locked = await veCrv.locked(OLD_LOCKER);
    var lockedAmount = locked["amount"];
    expect(await sdCRVToken.balanceOf(DAO)).to.equal(lockedAmount.sub(balance));
  });

  it("user with sdVeCRV should be able to lock & receive equal amount in sdCRV", async function () {
    this.enableTimeouts(false);
    await sdVeCrv.connect(sdVeCrvWhale1).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(sdVeCrvWhale1).lockSdveCrvToSdCrv(parseEther("1"));
    expect(await sdCRVToken.balanceOf(crvDepositor.address)).to.equal(parseEther("1"));
  });

  it("user with sdVeCRV should be able to lock sdVeCRV a second time & receive equal amount in sdCRV", async function () {
    this.enableTimeouts(false);
    await sdVeCrv.connect(sdVeCrvWhale1).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(sdVeCrvWhale1).lockSdveCrvToSdCrv(parseEther("1"));
    expect(await sdCRVToken.balanceOf(crvDepositor.address)).to.equal(parseEther("2"));
  });

  it("user should be able to deposit CRV", async function () {
    await crv.connect(crvWhale).approve(crvDepositor.address, parseEther("1"));
    await crvDepositor.connect(crvWhale).deposit(parseEther("1"), false, false, crvWhale._address);
    expect(await sdCRVToken.balanceOf(crvWhale._address)).to.equal(parseEther("0.999"));
  });
});