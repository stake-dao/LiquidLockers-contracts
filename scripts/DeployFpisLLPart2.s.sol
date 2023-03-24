// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {sdToken} from "contracts/tokens/sdToken.sol";
import {Constants} from "test/fixtures/Constants.sol";
import {DepositorV2} from "contracts/depositors/DepositorV2.sol";
import {ILiquidityGauge} from "contracts/interfaces/ILiquidityGauge.sol";
import {IVeFPIS} from "contracts/interfaces/IVeFPIS.sol";
import {TransparentUpgradeableProxy} from "contracts/external/TransparentUpgradeableProxy.sol";
import {FpisAccumulator} from "contracts/accumulators/FpisAccumulator.sol";
import {FpisLocker} from "contracts/lockers/FpisLocker.sol";
import {VeSDTFeeFpisProxy} from "contracts/accumulators/VeSDTFeeFpisProxy.sol";

contract DeployFpisLLPart2 is Script, Test {
    sdToken public sdFPIS;
    FpisAccumulator internal fpisAccumulator;
    DepositorV2 internal depositor;
    FpisLocker internal fpisLocker = FpisLocker(0x1ce5181124c33Abc281BF0F07eF4fB8573556aA5);
    VeSDTFeeFpisProxy internal veSdtFeeProxy;

    ILiquidityGauge public liquidityGauge;
    address public lgv4Impl = 0x93c951D3281Cc79e9FE1B1C87e50693D202F4C17; // sdAngle impl
    address public daoRecipient = Constants.STDDEPLOYER;
    address public bribeRecipient = Constants.STDDEPLOYER;

    IERC20 internal FPIS = IERC20(Constants.FPIS);

    function run() public {
        vm.startBroadcast(Constants.SDTNEWDEPLOYER);
        // deploy sdFPIS
        sdFPIS = new sdToken("Stake DAO FPIS", "sdFPIS");

        // Deploy LiquidityGauge
        liquidityGauge = ILiquidityGauge(
            address(
                new TransparentUpgradeableProxy(
                lgv4Impl,
                Constants.PROXY_ADMIN,
                abi.encodeWithSignature(
                "initialize(address,address,address,address,address,address)",
                address(sdFPIS),
                Constants.SDTNEWDEPLOYER,
                Constants.SDT,
                Constants.VE_SDT,
                Constants.VE_SDT_BOOST_PROXY,
                Constants.SDT_DISTRIBUTOR
                )
                )
            )
        );

        address[] memory fraxSwapPath = new address[](2);
        fraxSwapPath[0] = Constants.FPIS;
        fraxSwapPath[1] = Constants.FRAX;
        veSdtFeeProxy = new VeSDTFeeFpisProxy(fraxSwapPath);

        // Deploy Accumulator Contract
        fpisAccumulator = new FpisAccumulator(
            address(FPIS), 
            address(liquidityGauge),
            daoRecipient,
            bribeRecipient,
            address(veSdtFeeProxy)
        );

        // Deploy Depositor Contract
        depositor = new DepositorV2(address(FPIS), address(fpisLocker), address(sdFPIS), 4 * Constants.YEAR);

        // Setters
        // Accumulator
        fpisAccumulator.setLocker(address(fpisLocker));
        // Depositor
        depositor.setGauge(address(liquidityGauge));

        // Add Reward to LGV4
        liquidityGauge.add_reward(address(FPIS), address(fpisAccumulator));

        // Locker
        fpisLocker.setFpisDepositor(address(depositor));
        fpisLocker.setAccumulator(address(fpisAccumulator));

        // Custom part to create the lock and mint sdFPIS manually
        uint256 amountToLock = 1e18;
        IERC20(FPIS).transfer(address(fpisLocker), amountToLock);
        fpisLocker.createLock(amountToLock, block.timestamp + (4 * Constants.YEAR));

        // mint 1 sdFPIS
        sdFPIS.mint(Constants.SDTNEWDEPLOYER, amountToLock);
        // sdFPIS
        sdFPIS.setOperator(address(depositor));

        vm.stopBroadcast();
    }
}
