// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "forge-std/Script.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { sdToken } from "contracts/tokens/sdToken.sol";
import { Constants } from "test/foundry/fixtures/Constants.sol";
import { DepositorV2 } from "contracts/depositors/DepositorV2.sol";
import { ILiquidityGauge } from "contracts/interfaces/ILiquidityGauge.sol";
import { IRewardPool } from "contracts/interfaces/IRewardPool.sol";
import { IVeYFI } from "contracts/interfaces/IVeYFI.sol";
import { TransparentUpgradeableProxy } from "contracts/external/TransparentUpgradeableProxy.sol";
import { YearnAccumulator } from "contracts/accumulators/YearnAccumulator.sol";
import { YearnLocker } from "contracts/lockers/YearnLocker.sol";

contract DeployYearnLL is Script, Test {

    sdToken public sdYFI;
    YearnAccumulator internal yearnAccumulator;
    DepositorV2 internal depositor;
    YearnLocker internal yearnLocker;

    ILiquidityGauge public liquidityGauge;
    address public lgv4Impl = 0x93c951D3281Cc79e9FE1B1C87e50693D202F4C17; // sdAngle impl

    // Yearn contracts deployed
    IERC20 internal YFI = IERC20(Constants.YFI);
    IVeYFI internal veYFI = IVeYFI(Constants.VE_YFI);
    IRewardPool internal rewardPool = IRewardPool(Constants.YFI_REWARD_POOL);

    function run() public { 
        vm.startBroadcast(Constants.SDTNEWDEPLOYER);
        // deploy sdYFI
        sdYFI = new sdToken("Stake DAO YFI", "sdYFI");

        // Deploy LiquidityGauge
		liquidityGauge = ILiquidityGauge(address(new TransparentUpgradeableProxy(
			lgv4Impl,
			Constants.PROXY_ADMIN,
			abi.encodeWithSignature(
				"initialize(address,address,address,address,address,address)",
				address(sdYFI),
				Constants.SDTNEWDEPLOYER,
				Constants.SDT,
				Constants.VE_SDT,
				Constants.VE_SDT_BOOST_PROXY,
				Constants.SDT_DISTRIBUTOR
			)
		)));

        // Deploy Accumulator Contract
		yearnAccumulator = new YearnAccumulator(address(Constants.YFI), address(liquidityGauge));

        // Deploy and Intialize the YearnLocker contract
        bytes32 lockerSalt = bytes32(uint256(uint160(0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e)) << 96); // YFI address
		yearnLocker = new YearnLocker{salt: lockerSalt}(address(yearnAccumulator), address(veYFI), address(rewardPool));
		yearnLocker.approveUnderlying();

        // Deploy Depositor Contract
        depositor = new DepositorV2(Constants.YFI, address(yearnLocker), address(sdYFI), 4 * Constants.YEAR);

        // Setters
        // Accumulator
		yearnAccumulator.setLocker(address(yearnLocker));
        // Depositor
		depositor.setGauge(address(liquidityGauge));
        
        // Add Reward to LGV4
		liquidityGauge.add_reward(Constants.YFI, address(yearnAccumulator));

        // Locker
		yearnLocker.setYFIDepositor(address(depositor));
        yearnLocker.setAccumulator(address(yearnAccumulator));

        // Custom part to create the lock and mint sdYFI manually
        // New deployer needs to hold at least 1 YFI
        uint256 amountToLock = 1e18;
        IERC20(YFI).transfer(address(yearnLocker), amountToLock);
		yearnLocker.createLock(amountToLock, block.timestamp + (4 * Constants.YEAR));

        // mint 1 sdYFI
        sdYFI.mint(Constants.SDTNEWDEPLOYER, amountToLock);
        // sdYFI
		sdYFI.setOperator(address(depositor));

        vm.stopBroadcast();
    }
}