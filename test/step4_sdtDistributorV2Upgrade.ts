import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";
import ERC20ABI from "./fixtures/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";
import {
  SDT,
  STDDEPLOYER,
  ANGLE,
  ANGLE_LOCKER
} from "./constant";

const GC_STRATEGY = "0x3F3F0776D411eb97Cfa4E3eb25F33c01ca4e7Ca8";
const SDT_D_V2 = "0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C";
const PROXY_ADMIN = "0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B";
const ANGLE_STRATEGY = "0x22635427C72e8b0028FeAE1B5e1957508d9D7CAF";
const SAN_FRAX_EUR = "0xb3B209Bb213A5Da5B947C56f2C770b3E1015f1FE";
const SDSAN_FRAX_EUR_GAUGE = "0xB6261Be83EA2D58d8dd4a73f3F1A353fa1044Ef7";
const SDSAN_FRAX_EUR_VAULT = "0x1BD865ba36A510514d389B2eA763bad5d96b6ff9";
const SAN_FRAX_EUR_GAUGE = "0xb40432243E4F317cE287398e72Ab8f0312fc2FE8";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

describe("SDTDistributor V2 using Angle Gauges", function () {
  let deployer: JsonRpcSigner;

  let gc: Contract;
  let sdt: Contract;
  let angle: Contract;
  let sdtDistributorV2: Contract;
  let sdtDistributorV2New: Contract;
  let proxyAdmin: Contract;
  let angleStrategy: Contract;
  let vault: Contract;
  let sanFraxEurGauge: Contract;

  before(async function () {

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STDDEPLOYER]
    });

    const SdtDistributorV2New = await ethers.getContractFactory("SdtDistributorV2New");

    deployer = ethers.provider.getSigner(STDDEPLOYER);

    await network.provider.send("hardhat_setBalance", [STDDEPLOYER, ETH_100]);

    gc = await ethers.getContractAt("GaugeController", GC_STRATEGY);
    sdt = await ethers.getContractAt(ERC20ABI, SDT);
    angle = await ethers.getContractAt(ERC20ABI, ANGLE);
    vault = await ethers.getContractAt("AngleVault", SDSAN_FRAX_EUR_VAULT);
    proxyAdmin = await ethers.getContractAt("ProxyAdmin", PROXY_ADMIN);
    angleStrategy = await ethers.getContractAt("AngleStrategy", ANGLE_STRATEGY);
    sanFraxEurGauge = await ethers.getContractAt("LiquidityGaugeV4", SAN_FRAX_EUR_GAUGE);
    sdtDistributorV2 = await ethers.getContractAt("TransparentUpgradeableProxy", SDT_D_V2);
    // Deploy new SdtDistributorV2 implementation
    sdtDistributorV2New = await SdtDistributorV2New.deploy();
  });

  describe("SDTDistributor", function () {
    it("should not claim for a strategy with a gauge not included in the GC", async () => {
        await expect(angleStrategy.claim(SAN_FRAX_EUR)).to.be.reverted;
    });

    it("should upgrade the SdtDistributorV2 contract", async () => {
        await proxyAdmin.connect(deployer).upgrade(sdtDistributorV2.address, sdtDistributorV2New.address);
    });

    it("should claim for a strategy with a gauge not included in the GC", async () => {
        const angleBalanceBefore = await angle.balanceOf(SDSAN_FRAX_EUR_GAUGE);
        const angleClaimableBeforeClaim = await sanFraxEurGauge.claimable_reward(ANGLE_LOCKER, angle.address);
        expect(angleClaimableBeforeClaim).gt(0);
        angleStrategy.claim(SAN_FRAX_EUR);
        const angleClaimed = await sanFraxEurGauge.claimed_reward(ANGLE_LOCKER, angle.address);
        expect(angleClaimed).gt(0);
        const angleClaimableAfterClaim = await sanFraxEurGauge.claimable_reward(ANGLE_LOCKER, angle.address);
        expect(angleClaimableAfterClaim).eq(0);
        const angleBalanceAfter = await angle.balanceOf(SDSAN_FRAX_EUR_GAUGE);
        expect(angleBalanceAfter.sub(angleBalanceBefore)).gt(0)
    });
  });
});