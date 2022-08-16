import { expect } from "chai";
import { ethers, network } from "hardhat";

import { parseEther } from "@ethersproject/units";
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { JsonRpcSigner } from "@ethersproject/providers";

import ERC20ABI from "./fixtures/ERC20.json";

import {
    BAL,
    BAL_HOLDER,
    SD_BAL,
} from "./constant";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const SD_BAL_GAUGE = "0x3E8C72655e48591d93e6dfdA16823dB0fF23d859";

describe("Balancer Depositor", function () {
    // Contract
    let sdBalToken: Contract;
    let sdBalGauge: Contract;
    let bal: Contract;
    let balancerZapper: Contract;

    // Helper Signers
    let balHolder: JsonRpcSigner;
    let alice: SignerWithAddress

    before(async function () {
        [alice] = await ethers.getSigners();
        // tokens
        bal = await ethers.getContractAt(ERC20ABI, BAL);
        sdBalToken = await ethers.getContractAt("sdToken", SD_BAL);

        // Impersonate bal token holder and fill with ETH
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [BAL_HOLDER]
        });
        await network.provider.send("hardhat_setBalance", [BAL_HOLDER, ETH_100]);
        balHolder = ethers.provider.getSigner(BAL_HOLDER);

        // Deploy Balancer Zapper
        const BalancerZapper = await ethers.getContractFactory("BalancerZapper");
        balancerZapper = await BalancerZapper.deploy();

        // sdBal gauge
        sdBalGauge = await ethers.getContractAt("LiquidityGaugeV4", SD_BAL_GAUGE);
    });

    describe("Balancer Zapper", function () {
        it("Should zap from BAL token", async function () {
            const amountToLock = parseEther("100");
            const minAmount = 0;
            await bal.connect(balHolder).approve(balancerZapper.address, amountToLock.mul(3));
            const balanceBeforeZap = await sdBalToken.balanceOf(balHolder._address);

            // Zap BAL to obtain sdBAL without staking and locking
            await balancerZapper.connect(balHolder).zapFromBal(amountToLock, false, false, minAmount, balHolder._address);

            const balanceAfterZap = await sdBalToken.balanceOf(balHolder._address);
            expect(balanceAfterZap.sub(balanceBeforeZap)).gt(0);

            // Zap BAL to obtain sdBAL, staking but not locking sdBal
            await balancerZapper.connect(balHolder).zapFromBal(amountToLock, true, false, minAmount, balHolder._address);

            const balanceAfterZapZap = await sdBalToken.balanceOf(balHolder._address);
            // It obtained more sdBAL in the second deposit thanks to locking them
            expect(balanceAfterZapZap.div(2)).gt(balanceAfterZap.sub(balanceBeforeZap));

            const gaugeBalanceBefore = await sdBalGauge.balanceOf(balHolder._address);

            // Zap BAL to obtain sdBAL, staking and locking sdBal to the LGV4
            await balancerZapper.connect(balHolder).zapFromBal(amountToLock, true, true, minAmount, balHolder._address);

            const balanceAfterZapZapZap = await sdBalToken.balanceOf(balHolder._address);
            expect(balanceAfterZapZapZap).eq(balanceAfterZapZap);

            const gaugeBalanceAfter = await sdBalGauge.balanceOf(balHolder._address);
            expect(gaugeBalanceAfter.sub(gaugeBalanceBefore)).gt(0);

            const zapperBalBalance = await bal.balanceOf(balancerZapper.address);
            expect(zapperBalBalance).eq(0);

        });

        it("Should zap for another user", async function () {
            const amountToLock = parseEther("100");
            const minAmount = 0;
            await bal.connect(balHolder).approve(balancerZapper.address, amountToLock.mul(2));
            const balanceBeforeZap = await sdBalToken.balanceOf(alice.address);

            // Zap BAL to obtain sdBAL, staking but not locking sdBal, for another user
            await balancerZapper.connect(balHolder).zapFromBal(amountToLock, true, false, minAmount, alice.address);

            const balanceAfterZap = await sdBalToken.balanceOf(alice.address);
            expect(balanceAfterZap.sub(balanceBeforeZap)).gt(0);

            const gaugeBalanceBefore = await sdBalGauge.balanceOf(alice.address);

            // Zap BAL to obtain sdBAL, staking and locking sdBal to the LGV4, for another user
            await balancerZapper.connect(balHolder).zapFromBal(amountToLock, true, true, minAmount, alice.address);

            const balanceAfterZapZap = await sdBalToken.balanceOf(alice.address);
            expect(balanceAfterZapZap).eq(balanceAfterZap);

            const gaugeBalanceAfter = await sdBalGauge.balanceOf(alice.address);
            expect(gaugeBalanceAfter.sub(gaugeBalanceBefore)).gt(0);

            const zapperBalBalance = await bal.balanceOf(balancerZapper.address);
            expect(zapperBalBalance).eq(0);

        });
    });
});