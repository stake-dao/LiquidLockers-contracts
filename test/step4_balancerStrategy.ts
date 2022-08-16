import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";
import BalancerHelperAbi from "./fixtures/BalancerHelper.json";
import { writeBalance } from "./utils";
import {  
  SDT, 
  BAL, 
  BALANCER_LOCKER, 
  BALANCER_ACCUMULATOR,
  SDT_DISTRIBUTOR_STRAT
} from "./constant";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();


const BALANCER_HELPER = "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E";
const STDDEPLOYER = "0xb36a0671b3d49587236d7833b01e79798175875f";
const LDO = "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32";

const WSTETH_ETH_BPT = "0x32296969Ef14EB0c6d29669C550D4a0449130230"; // 1
const WSTETH_ETH_GAUGE = "0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE";
const BADGER_WBTC_BPT = "0xb460DAa847c45f1C4a41cb05BFB3b51c92e41B36"; // 2
const BADGER_WBTC_GAUGE = "0xAF50825B010Ae4839Ac444f6c12D44b96819739B";
const WETH_FEI_BPT = "0x90291319f1d4ea3ad4db0dd8fe9e12baf749e845"; // 3
const WETH_FEI_GAUGE = "0x4f9463405F5bC7b4C1304222c1dF76EFbD81a407";
const WETH_DAI_BPT = "0x0b09deA16768f0799065C475bE02919503cB2a35"; // 4
const WETH_DAI_GAUGE = "0x4ca6AC0509E6381Ca7CD872a6cdC0Fbf00600Fa1";
const LDO_WETH_BPT = "0xBF96189Eee9357a95C7719f4F5047F76bdE804E5"; // 5
const LDO_WETH_GAUGE = "0x942CB1Ed80D3FF8028B3DD726e0E2A9671bc6202";
const YFI_WETH_BPT = "0x186084fF790C65088BA694Df11758faE4943EE9E"; // 6
const YFI_WETH_GAUGE = "0x5F4d57fd9Ca75625e4B7520c71c02948A48595d0";
const WBTC_WETH_BPT = "0xA6F548DF93de924d73be7D25dC02554c6bD66dB5"; // 7
const WBTC_WETH_GAUGE = "0x4E3c048BE671852277Ad6ce29Fd5207aA12fabff";
const GNO_WETH_BPT = "0xF4C0DD9B82DA36C07605df83c8a416F11724d88b"; // 8
const GNO_WETH_GAUGE = "0xCB664132622f29943f67FA56CCfD1e24CC8B4995";
const USDC_WETH_BPT = "0x96646936b91d6B9D7D0c47C496AfBF3D6ec7B6f8"; // 9
const USDC_WETH_GAUGE = "0x9AB7B0C7b154f626451c9e8a68dC04f58fb6e5Ce";
const CREAM_WETH_BPT = "0x85370D9e3bb111391cc89F6DE344E80176046183"; // 10
const CREAM_WETH_GAUGE = "0x9F65d476DD77E24445A48b4FeCdeA81afAA63480";
const RETH_WETH_BPT = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"; // 11
const RETH_WETH_GAUGE = "0x79eF6103A513951a3b25743DB509E267685726B7";
const SNX_WETH_BPT = "0x072f14B85ADd63488DDaD88f855Fda4A99d6aC9B"; // 12
const SNX_WETH_GAUGE = "0x605eA53472A496c3d483869Fe8F355c12E861e19";
const LINK_WETH_BPT = "0xE99481DC77691d8E2456E5f3F61C1810adFC1503"; // 13
const LINK_WETH_GAUGE = "0x31e7F53D27BFB324656FACAa69Fe440169522E1C";
const WETH_COW_BPT = "0xde8C195Aa41C11a0c4787372deFBbDdAa31306D2"; // 14
const WETH_COW_GAUGE = "0x158772F59Fe0d3b75805fC11139b46CBc89F70e5";
const HAUS_WETH_BPT = "0x17dDd9646a69C9445CD8A9f921d4cD93BF50D108"; // 15
const HAUS_WETH_GAUGE = "0xa57453737849A4029325dfAb3F6034656644E104";
const MATIC_WETH_BPT = "0xa02E4b3d18D4E6B8d18Ac421fBc3dfFF8933c40a"; // 16
const MATIC_WETH_GAUGE = "0x4e311e207CEAaaed421F17E909DA16527565Daef";

const getNow = async function () {
  let blockNum = await ethers.provider.getBlockNumber();
  let block = await ethers.provider.getBlock(blockNum);
  var time = block.timestamp;
  return time;
};

describe("Balancer Strategy Vault", function () {
  let balancerHelper: Contract;
  let localDeployer: SignerWithAddress;
  let veSDTFeeProxy: Contract;
  let dummyMs: SignerWithAddress;
  let alice: SignerWithAddress;
  let deployer: JsonRpcSigner;
  let balancerStrategy: Contract;
  let bal: Contract;
  let sdt: Contract;
  let ldo: Contract;
  let locker: Contract;
  let vaultFactory: Contract;
  let vault1: Contract;
  let gauge1: Contract;
  let vault2: Contract;
  let gauge2: Contract;
  let vault3: Contract;
  let gauge3: Contract;
  let vault4: Contract;
  let gauge4: Contract;
  let vault5: Contract;
  let gauge5: Contract;
  let vault6: Contract;
  let gauge6: Contract;
  let vault7: Contract;
  let gauge7: Contract;
  let vault8: Contract;
  let gauge8: Contract;
  let vault9: Contract;
  let gauge9: Contract;
  let vault10: Contract;
  let gauge10: Contract;
  let vault11: Contract;
  let gauge11: Contract;
  let vault12: Contract;
  let gauge12: Contract;
  let vault13: Contract;
  let gauge13: Contract;
  let vault14: Contract;
  let gauge14: Contract;
  let vault15: Contract;
  let gauge15: Contract;
  let vault16: Contract;
  let gauge16: Contract;
  let wsethEthBpt: Contract;
  let badgerWbtcBpt: Contract;
  let wethFeiBpt: Contract;
  before(async function () {
    [localDeployer, dummyMs, alice] = await ethers.getSigners();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });


    await writeBalance(WSTETH_ETH_BPT, "1000", alice.address);
    await writeBalance(BADGER_WBTC_BPT, "1000", alice.address);
    await writeBalance(WETH_FEI_BPT, "1000", alice.address);
    await writeBalance(WETH_DAI_BPT, "1000", alice.address);
    await writeBalance(LDO_WETH_BPT, "1000", alice.address);
    await writeBalance(YFI_WETH_BPT, "1000", alice.address);
    await writeBalance(WBTC_WETH_BPT, "1000", alice.address);
    await writeBalance(GNO_WETH_BPT, "1000", alice.address);
    await writeBalance(USDC_WETH_BPT, "1000", alice.address);
    await writeBalance(CREAM_WETH_BPT, "1000", alice.address);
    await writeBalance(RETH_WETH_BPT, "1000", alice.address);
    await writeBalance(SNX_WETH_BPT, "1000", alice.address);
    await writeBalance(LINK_WETH_BPT, "1000", alice.address);
    await writeBalance(WETH_COW_BPT, "1000", alice.address);
    await writeBalance(HAUS_WETH_BPT, "1000", alice.address);
    await writeBalance(MATIC_WETH_BPT, "1000", alice.address);

    // Mainnet contracts 
    balancerHelper = await ethers.getContractAt(BalancerHelperAbi, BALANCER_HELPER);
    wsethEthBpt = await ethers.getContractAt("ERC20", WSTETH_ETH_BPT);
    badgerWbtcBpt = await ethers.getContractAt("ERC20", BADGER_WBTC_BPT);
    sdt = await ethers.getContractAt("ERC20", SDT);
    bal = await ethers.getContractAt("ERC20", BAL);
    ldo = await ethers.getContractAt("ERC20", LDO);
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
    const gauge2Addr = vault2Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    gauge2 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge2Addr);
    vault2 = await ethers.getContractAt("BalancerVault", vault2Tx.events[0].args[0]);
    const vault3Tx =await (await vaultFactory.cloneAndInit(WETH_FEI_GAUGE)).wait(); // vault3
    const gauge3Addr = vault3Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    gauge3 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge3Addr);
    vault3 = await ethers.getContractAt("BalancerVault", vault3Tx.events[0].args[0]);
    const vault4Tx = await (await vaultFactory.cloneAndInit(WETH_DAI_GAUGE)).wait(); // vault4
    const gauge4Addr = vault4Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0]; 
    gauge4 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge4Addr);
    vault4 = await ethers.getContractAt("BalancerVault", vault4Tx.events[0].args[0]);
    const vault5Tx = await (await vaultFactory.cloneAndInit(YFI_WETH_GAUGE)).wait(); // vault5
    const gauge5Addr = vault5Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    gauge5 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge5Addr);
    vault5 = await ethers.getContractAt("BalancerVault", vault5Tx.events[0].args[0]);
    const vault6Tx = await (await vaultFactory.cloneAndInit(LDO_WETH_GAUGE)).wait(); // vault6
    const gauge6Addr = vault6Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    gauge6 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge6Addr);
    vault6 = await ethers.getContractAt("BalancerVault", vault6Tx.events[0].args[0]);
    const vault7Tx = await (await vaultFactory.cloneAndInit(WBTC_WETH_GAUGE)).wait(); // vault7
    const gauge7Addr = vault7Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    gauge7 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge7Addr);
    vault7 = await ethers.getContractAt("BalancerVault", vault7Tx.events[0].args[0]);
    const vault8Tx = await (await vaultFactory.cloneAndInit(GNO_WETH_GAUGE)).wait(); // vault8
    const gauge8Addr = vault8Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    gauge8 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge8Addr);
    vault8 = await ethers.getContractAt("BalancerVault", vault8Tx.events[0].args[0]);
    const vault9Tx = await (await vaultFactory.cloneAndInit(USDC_WETH_GAUGE)).wait(); // vault9
    const gauge9Addr = vault9Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    gauge9 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge9Addr);
    vault9 = await ethers.getContractAt("BalancerVault", vault9Tx.events[0].args[0]);
    const vault10Tx = await (await vaultFactory.cloneAndInit(CREAM_WETH_GAUGE)).wait(); // vault10
    const gauge10Addr = vault10Tx.events.filter((e: { event: string }) => e.event == "GaugeDeployed")[0].args[0];
    gauge10 = await ethers.getContractAt("LiquidityGaugeV4Strat", gauge10Addr);
    vault10 = await ethers.getContractAt("BalancerVault", vault10Tx.events[0].args[0]);
  });

  it("Should deposit BPTs to vault and get gauge tokens", async function () {
    const amountToDeposit = parseEther("1000");
    const vaultKeeperFee = await vault1.keeperFee();
    const maxFee = await vault1.max();
    
    // deposit to vaults + earn
    // vault 1
    const vault1BalanceBeforeDeposit = await wsethEthBpt.balanceOf(vault1.address);
    await wsethEthBpt.connect(alice).approve(vault1.address, amountToDeposit);
    await vault1.connect(alice).deposit(alice.address, amountToDeposit, true);
    const vault1BalanceAfterDeposit = await wsethEthBpt.balanceOf(vault1.address);
    const gauge1TokenBalanceOfDepositor = await gauge1.balanceOf(alice.address);
    expect(vault1BalanceBeforeDeposit).eq(0);
    expect(vault1BalanceAfterDeposit).eq(0);
    expect(gauge1TokenBalanceOfDepositor).to.be.equal(amountToDeposit);
    // vault 2
    const vault2BalanceBeforeDeposit = await badgerWbtcBpt.balanceOf(vault2.address);
    await badgerWbtcBpt.connect(alice).approve(vault2.address, amountToDeposit);
    await vault2.connect(alice).deposit(alice.address, amountToDeposit, true);
    const vault2BalanceAfterDeposit = await badgerWbtcBpt.balanceOf(vault1.address);
    const gauge2TokenBalanceOfDepositor = await gauge2.balanceOf(alice.address);
    expect(vault2BalanceBeforeDeposit).eq(0);
    expect(vault2BalanceAfterDeposit).eq(0);
    expect(gauge2TokenBalanceOfDepositor).to.be.equal(amountToDeposit);
  });
  it("Should claim BAL reward after some times without SDT", async function () {
    await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 6]); // 1 day
    await network.provider.send("evm_mine", []);
    // gauge2 Claim
    const balBefore = await bal.balanceOf(gauge1.address)
    const sdtBefore = await sdt.balanceOf(gauge1.address)
    const ldoBefore = await ldo.balanceOf(gauge1.address)
    expect(balBefore).eq(0);
    expect(sdtBefore).eq(0);
    expect(ldoBefore).eq(0);
    await balancerStrategy.claim(wsethEthBpt.address);
    const balBalanceStrat = await bal.balanceOf(balancerStrategy.address)
    const sdtBalanceStrat = await bal.balanceOf(balancerStrategy.address)
    const ldoBalanceStrat = await bal.balanceOf(balancerStrategy.address)
    console.log(balBalanceStrat.toString())
    console.log(sdtBalanceStrat.toString())
    console.log(ldoBalanceStrat.toString())
    const balClaimed = await bal.balanceOf(gauge1.address)
    const sdtClaimed = await sdt.balanceOf(gauge1.address)
    const ldoClaimed = await ldo.balanceOf(gauge1.address)
    console.log(ldoClaimed.toString());
    expect(balClaimed).gt(0);
    expect(ldoClaimed).gt(0);
    expect(sdtClaimed).eq(0);
  });
});
