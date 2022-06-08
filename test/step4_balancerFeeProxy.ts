import { expect } from "chai";
import { ethers, network } from "hardhat";

import { parseEther } from "@ethersproject/units";
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import ERC20ABI from "./fixtures/ERC20.json";

import {
    BAL,
    FEE_D_SD,
    HOLDER,
    SDFRAX3CRV
} from "./constant";

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

describe("Balancer Depositor", function () {
    // Signers
    let bob: SignerWithAddress;
    let deployer: SignerWithAddress;

    // Contract
    let bal: Contract;
    let sdFrax3Crv: Contract;
    let veSdtFeeProxy: Contract

    // Helper Signers
    let balHolder: JsonRpcSigner;

    before(async function () {
        [deployer, bob] = await ethers.getSigners();

        // tokens
        bal = await ethers.getContractAt(ERC20ABI, BAL);
        sdFrax3Crv = await ethers.getContractAt(ERC20ABI, SDFRAX3CRV);

        // Impersonate accounts and fill with ETH
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [HOLDER]
        });
        await network.provider.send("hardhat_setBalance", [HOLDER, ETH_100]);
        balHolder = ethers.provider.getSigner(HOLDER);

        // Get Contract Artifacts
        const VeSDTFeeProxy = await ethers.getContractFactory("VeSDTFeeBalancerProxy");
        veSdtFeeProxy = await VeSDTFeeProxy.deploy();
    });

    describe("VeSDTFeeProxy", function () {
        it("should zap BAL to sdFRAX3CRV and transfer them to the FeeDistributor", async function () {
            // Transfer Bal to the FeeProxy contract to simulate an harvest
            const amountToSend = parseEther("100")
            await bal.connect(balHolder).transfer(veSdtFeeProxy.address, amountToSend);

            const claimerFee = await veSdtFeeProxy.claimerFee();
            const baseFee = await veSdtFeeProxy.BASE_FEE();
            const balBalanceClaimerBefore = await bal.balanceOf(bob.address);
            const balancerFeeDBefore = await sdFrax3Crv.balanceOf(FEE_D_SD);
            await veSdtFeeProxy.connect(bob).sendRewards();
            const balBalanceClaimerAfter = await bal.balanceOf(bob.address);
            const balancerFeeDAfter = await sdFrax3Crv.balanceOf(FEE_D_SD);
            expect(balBalanceClaimerAfter.sub(balBalanceClaimerBefore)).eq(amountToSend.div(baseFee).mul(claimerFee))
            expect(balancerFeeDAfter.sub(balancerFeeDBefore)).gt(parseEther("640"));
        });
    });
});
