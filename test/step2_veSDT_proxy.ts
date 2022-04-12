import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import VESDTOLD from "./fixtures/veAngle.json";
import PROXY_A_ABI from "./fixtures/proxyAdmin.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const SDTWHALE = "0xb9d8dd19057b545a5227d3d4d76ad5746a9e2c81";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const VE_SDT_WHALE = "0x48238Faf05BF8B745249dB3c26606A72149600B8";

const VE_SDT = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";
const PROXY_ADMIN = "0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B";

const SDT_DEPLOYER = "0xb36a0671B3D49587236d7833B01E79798175875f";

const VE_SDT_PROXY = "0x0C30476f66034E11782938DF8e4384970B6c9e8a";

const thousand = parseEther("1000");

const ONEWEEK = 7 * 86400;
const MAXDURATION = 4 * 365 * 86400;
const GRMAXDURATION = 5 * 365 * 86400;

describe("veSDT", () => {
  let veSdt: Contract;
  let veSdtNew: Contract;
  let sdt: Contract;
  let proxyAdmin: Contract;
  let veSdtProxy: Contract;
  let sdtWhaleSigner: JsonRpcSigner;
  let sdtDeployer: JsonRpcSigner;
  let owner: SignerWithAddress;

  before(async function () {
    //this.enableTimeouts(false);

    [owner] = await ethers.getSigners();

    sdt = await ethers.getContractAt(ERC20, SDT);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDTWHALE]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDT_DEPLOYER]
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [VE_SDT_WHALE]
    });

    sdtWhaleSigner = await ethers.provider.getSigner(SDTWHALE);
    sdtDeployer = await ethers.provider.getSigner(SDT_DEPLOYER);
    await network.provider.send("hardhat_setBalance", [sdtWhaleSigner._address, parseEther("10").toHexString()]);

    const veSDT = await ethers.getContractFactory("veSDT");

    veSdt = await ethers.getContractAt(VESDTOLD, VE_SDT);
    veSdtNew = await veSDT.connect(owner).deploy();
    proxyAdmin = await ethers.getContractAt(PROXY_A_ABI, PROXY_ADMIN);
    veSdtProxy = await ethers.getContractAt("veSDT", VE_SDT_PROXY);
    sdt = await ethers.getContractAt(ERC20, SDT);
  });

  describe("Upgrade veSDT contract", async () => {
    it("Lock for another user before the upgrade", async () => {
      const amountToDeposit = parseEther("10");
      await sdt.connect(sdtWhaleSigner).approve(veSdtProxy.address, amountToDeposit.mul(3));
      await veSdtProxy.connect(sdtWhaleSigner).create_lock(amountToDeposit, "1680496649");
      await veSdtProxy.connect(sdtWhaleSigner).deposit_for(sdtWhaleSigner._address, amountToDeposit);
      await veSdtProxy.deposit_for(sdtWhaleSigner._address, amountToDeposit);
    });

    it("Upgrade the contract via proxyAdmin", async () => {
      veSdtProxy = await ethers.getContractAt("TransparentUpgradeableProxy", veSdtProxy.address);
      // upgrade the proxy with the new veSdt contract
      await proxyAdmin.connect(sdtDeployer).upgrade(veSdtProxy.address, veSdtNew.address);
    });

    it("Lock SDT", async () => {
      veSdtProxy = await ethers.getContractAt("veSDT", veSdtProxy.address);
      const amountToDeposit = parseEther("10");
      await sdt.connect(sdtWhaleSigner).approve(veSdtProxy.address, amountToDeposit.mul(2));
      await veSdtProxy.connect(sdtWhaleSigner).deposit_for(sdtWhaleSigner._address, amountToDeposit);
      // no one can deposit for other users
      await expect(veSdtProxy.deposit_for(sdtWhaleSigner._address, amountToDeposit)).to.be.reverted;
    });
  });
});
