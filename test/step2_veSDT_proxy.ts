import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract } from "@ethersproject/contracts";
import { parseEther } from "@ethersproject/units";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20 from "./fixtures/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AbiCoder } from "ethers/lib/utils";

const SDTWHALE = "0x48238Faf05BF8B745249dB3c26606A72149600B8";
const SDT = "0x73968b9a57c6e53d41345fd57a6e6ae27d6cdb2f";
const thousand = parseEther("1000");

const ONEWEEK = 7 * 86400;
const MAXDURATION = 4 * 365 * 86400;
const GRMAXDURATION = 5 * 365 * 86400;

describe("veSDT", () => {
  let veSdt: Contract;
  let veSdtNew: Contract;
  let sdt: Contract;
  let proxy: Contract;
  let proxyAdmin: Contract;
  let sww: Contract;
  let sdtWhaleSigner: JsonRpcSigner;
  let owner: SignerWithAddress;

  before(async function () {
    this.enableTimeouts(false);

    [owner] = await ethers.getSigners();

    sdt = await ethers.getContractAt(ERC20, SDT);
    
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [SDTWHALE]
    });

    sdtWhaleSigner = await ethers.provider.getSigner(SDTWHALE);
    await network.provider.send("hardhat_setBalance", [sdtWhaleSigner._address, parseEther("10").toHexString()]);

    //await sdt.connect(sdtWhaleSigner).transfer(owner.getAddress(), parseEther("10000"));

    const veSDT = await ethers.getContractFactory("veSDT");
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const SWW = await ethers.getContractFactory("SmartWalletWhitelist");

    veSdt = await veSDT.connect(owner).deploy();
    veSdtNew = await veSDT.connect(owner).deploy(); // simulate a new veSDT contract to deploy
    proxyAdmin = await ProxyAdmin.connect(owner).deploy();
    sww = await SWW.connect(owner).deploy(owner.address);
    // ProxyAdmin address
    // token address
    // smartWalletWhitelist address
    // name string
    // symbol string
    let ABI = ["function initialize(address _admin, address token_addr, address _smart_wallet_checker, string _name, string _symbol)"]
    let iface = new ethers.utils.Interface(ABI)
    const data = iface.encodeFunctionData("initialize", [proxyAdmin.address, veSdt.address, sww.address, "Nae", "Syp"]) 
    proxy = await Proxy.connect(owner).deploy(veSdt.address, proxyAdmin.address, data);
  });

  describe("Upgrade veSDT contract", async () => {
    it("Upgrade the contract via proxyAdmin", async () => {
      await proxyAdmin.upgrade(proxy.address, veSdtNew.address);
    });
  });
});