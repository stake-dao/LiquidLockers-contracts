import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, parseUnits } from "@ethersproject/units";
import BalancerHelperAbi from "./fixtures/BalancerHelper.json";
import { writeBalance } from "./utils";
import { Signer } from "ethers";
import { 
  WETH, 
  SDT, 
  BAL, 
  BALANCER_LOCKER, 
  BALANCER_ACCUMULATOR,
  SDT_DISTRIBUTOR_STRAT
} from "./constant";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();


const BALANCER_HELPER = "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E";
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
//const LOCKER = "0xea79d1A83Da6DB43a85942767C389fE0ACf336A5";
//const BALANCERACCUMULATOR = "0x9A211c972AebF2aE70F1ec14845848baAB79d6Af";
//const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";

const WSTETH_ETH_BPT = "0x32296969Ef14EB0c6d29669C550D4a0449130230";
const WSTETH_ETH_GAUGE = "0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE";
const BADGER_WBTC_GAUGE = "0xAF50825B010Ae4839Ac444f6c12D44b96819739B";
const WETH_FEI_GAUGE = "0x4f9463405F5bC7b4C1304222c1dF76EFbD81a407";
const WETH_DAI_GAUGE = "0x4ca6AC0509E6381Ca7CD872a6cdC0Fbf00600Fa1";
const LDO_WETH_GAUGE = "0x942CB1Ed80D3FF8028B3DD726e0E2A9671bc6202";
const YFI_WETH_GAUGE = "0x5F4d57fd9Ca75625e4B7520c71c02948A48595d0";

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("Balancer Strategy Vault", function () {
  let balancerHelper: Contract;
  let localDeployer: SignerWithAddress;
  let wsteth: Contract;
  let weth: Contract;
  let veSDTFeeProxy: Contract;
  let dummyMs: SignerWithAddress;
  let alice: SignerWithAddress;
  let deployer: JsonRpcSigner;
  let lpToken: Contract;
  let balancerStrategy: Contract;
  let bal: Contract;
  let sdt: Contract;
  let locker: Contract;
  let ohmDaiWethLp: Contract;
  let vaultFactory: Contract;
  let vault1: Contract;
  let gauge1: Contract;
  let vault1BPTHolder: JsonRpcSigner;
  let vault2: Contract;
  let gauge2: Contract;
  let vault2BPTHolder: JsonRpcSigner;
  let vault3: Contract;
  let gauge3: Contract;
  let vault3BPTHolder: JsonRpcSigner;
  let vault4: Contract;
  let gauge4: Contract;
  let vault4BPTHolder: JsonRpcSigner;
  let vault5: Contract;
  let gauge5: Contract;
  let vault5BPTHolder: JsonRpcSigner;
  let vault6: Contract;
  let gauge6: Contract;
  let vault6BPTHolder: JsonRpcSigner;
  let wsethEthBpt: Contract;
  before(async function () {
    [localDeployer, dummyMs, alice] = await ethers.getSigners();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });


    //await writeBalance(WETH, "1000", localDeployer.address);
    //await writeBalance(WSTETH, "1000", localDeployer.address);
    await writeBalance(WSTETH_ETH_BPT, "1000", alice.address);

    // Mainnet contracts 
    balancerHelper = await ethers.getContractAt(BalancerHelperAbi, BALANCER_HELPER);
    wsethEthBpt = await ethers.getContractAt("ERC20", WSTETH_ETH_BPT);
    sdt = await ethers.getContractAt("ERC20", SDT);
    bal = await ethers.getContractAt("ERC20", BAL);
    locker = await ethers.getContractAt("BalancerLocker", BALANCER_LOCKER)

    // Signers 
    deployer = ethers.provider.getSigner(STDDEPLOYER);

    const VaultFactory = await ethers.getContractFactory("BalancerVaultFactory");
    const Strategy = await ethers.getContractFactory("BalancerStrategy");
    const FeeProxy = await ethers.getContractFactory("VeSDTFeeBalancerProxy");

    // Deploy contracts
    veSDTFeeProxy = await FeeProxy.deploy();
    balancerStrategy = await Strategy.deploy(
      BALANCER_LOCKER,
      localDeployer.address,
      localDeployer.address,
      BALANCER_ACCUMULATOR,
      veSDTFeeProxy.address,
      SDT_DISTRIBUTOR_STRAT,
    );
    vaultFactory = await VaultFactory.deploy(balancerStrategy.address);
    await balancerStrategy.setVaultGaugeFactory(vaultFactory.address);

    // change balancerLocker's governance address to the balancer strategy address 
    // NB we have to set it using the multisig on mainnet
    await network.provider.send("hardhat_setStorageAt", [
      locker.address,
      "0x0",
      "0x000000000000000000000000" + balancerStrategy.address.substring(2),
  ]);

    // Clone vaults
    const vault1Tx = await (await vaultFactory.cloneAndInit(WSTETH_ETH_GAUGE)).wait(); // vault1
    const gauge1Addr = vault1Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    gauge1 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge1Addr);
    vault1 = await ethers.getContractAt("BalancerVault", vault1Tx.events[0].args[0]);
    const vault2Tx = await (await vaultFactory.cloneAndInit(BADGER_WBTC_GAUGE)).wait(); // vault2
    gauge2 = vault2Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    vault2 = await ethers.getContractAt("BalancerVault", vault2Tx.events[0].args[0]);
    const vault3Tx =await (await vaultFactory.cloneAndInit(WETH_FEI_GAUGE)).wait(); // vault3
    gauge3 = vault3Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    vault3 = await ethers.getContractAt("BalancerVault", vault3Tx.events[0].args[0]);
    const vault4Tx = await (await vaultFactory.cloneAndInit(WETH_DAI_GAUGE)).wait(); // vault4
    gauge4 = vault4Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    vault4 = await ethers.getContractAt("BalancerVault", vault4Tx.events[0].args[0]);
    const vault5Tx = await (await vaultFactory.cloneAndInit(YFI_WETH_GAUGE)).wait(); // vault5
    gauge5 = vault5Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    vault5 = await ethers.getContractAt("BalancerVault", vault5Tx.events[0].args[0]);
    const vault6Tx = await (await vaultFactory.cloneAndInit(LDO_WETH_GAUGE)).wait(); // vault6
    gauge6 = vault6Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    vault6 = await ethers.getContractAt("BalancerVault", vault6Tx.events[0].args[0]);
  });

  it("Should deposit BPTs to vault and get gauge tokens", async function () {
    const amountToDeposit = parseEther("1000");
    const vault1BalanceBeforeDeposit = await wsethEthBpt.balanceOf(vault1.address);
    const vaultKeeperFee = await vault1.keeperFee();
    const maxFee = await vault1.max();
    
    // deposit to vault
    // vault 1
    await wsethEthBpt.connect(alice).approve(vault1.address, amountToDeposit);
    await vault1.connect(alice).deposit(alice.address, amountToDeposit, true);
    const vault1BalanceAfterDeposit = await wsethEthBpt.balanceOf(vault1.address);
    const gaugeTokenBalanceOfDepositor = await gauge1.balanceOf(alice.address);
    expect(vault1BalanceBeforeDeposit).eq(0);
    expect(vault1BalanceAfterDeposit).eq(0);
    //const amountForKeeper = amountToDeposit.div(maxFee).mul(vaultKeeperFee);
    //const amountForUser = amountToDeposit.sub(amountForKeeper);
    expect(gaugeTokenBalanceOfDepositor).to.be.equal(amountToDeposit);
  });
  it("Should claim BAL reward after some times without SDT", async function () {
    await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 6]); // 1 day
    await network.provider.send("evm_mine", []);
    const balBefore = await bal.balanceOf(gauge1.address)
    const sdtBefore = await sdt.balanceOf(gauge1.address)
    expect(balBefore).eq(0);
    expect(sdtBefore).eq(0);
    await balancerStrategy.claim(wsethEthBpt.address);
    const balClaimed = await bal.balanceOf(gauge1.address)
    const sdtClaimed = await sdt.balanceOf(gauge1.address)
    console.log(balClaimed.toString());
    expect(balClaimed).gt(0);
    expect(sdtClaimed).eq(0);
  });
});
