// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import {AddressBook} from "addressBook/AddressBook.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {sdFPIS} from "contracts/tokens/sdFPIS.sol";
import {DepositorV3} from "contracts/depositors/DepositorV3.sol";
import {ILiquidityGauge} from "contracts/interfaces/ILiquidityGauge.sol";
import {IVeFPIS} from "contracts/interfaces/IVeFPIS.sol";
import {TransparentUpgradeableProxy} from "contracts/external/TransparentUpgradeableProxy.sol";
import {FpisAccumulator} from "contracts/accumulators/FpisAccumulator.sol";
import {FpisLocker} from "contracts/lockers/FpisLocker.sol";
import {VeSDTFeeFpisProxy} from "contracts/accumulators/VeSDTFeeFpisProxy.sol";

contract DeployFpisLLPart2 is Script, Test {
    sdFPIS public sdFpis;
    FpisAccumulator internal fpisAccumulator;
    DepositorV3 internal depositor;
    FpisLocker internal fpisLocker = FpisLocker(0x1ce5181124c33Abc281BF0F07eF4fB8573556aA5);
    VeSDTFeeFpisProxy internal veSdtFeeProxy;

    ILiquidityGauge public liquidityGauge;
    address public lgv4Impl = 0x93c951D3281Cc79e9FE1B1C87e50693D202F4C17; // sdAngle impl
    

    IERC20 internal FPIS = IERC20(AddressBook.FPIS);

    address newDeployer = AddressBook.SDTNEWDEPLOYER;
    address public msDao = 0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063;
    address public daoRecipient = msDao;
    address public bribeRecipient = msDao;

    function run() public {
        vm.startBroadcast(newDeployer);
        // deploy sdFPIS
        sdFpis = new sdFPIS(newDeployer, newDeployer);

        // Deploy LiquidityGauge
        liquidityGauge = ILiquidityGauge(
            address(
                new TransparentUpgradeableProxy(
                lgv4Impl,
                AddressBook.PROXY_ADMIN,
                abi.encodeWithSignature(
                "initialize(address,address,address,address,address,address)",
                address(sdFpis),
                newDeployer,
                AddressBook.SDT,
                AddressBook.VE_SDT,
                AddressBook.VE_SDT_BOOST_PROXY,
                AddressBook.SDT_DISTRIBUTOR
                )
                )
            )
        );

        address[] memory fraxSwapPath = new address[](2);
        fraxSwapPath[0] = address(FPIS);
        fraxSwapPath[1] = AddressBook.FRAX;
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
        depositor = new DepositorV3(address(FPIS), address(fpisLocker), address(sdFpis), 4 * AddressBook.YEAR);

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
        fpisLocker.createLock(amountToLock, block.timestamp + (4 * AddressBook.YEAR));

        // mint 1 sdFPIS
        sdFpis.mint(newDeployer, amountToLock);
        // sdFPIS
        sdFpis.setMinterOperator(address(depositor));

        vm.stopBroadcast();
    }
}
