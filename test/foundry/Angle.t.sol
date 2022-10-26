// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";

// Contract
import "contracts/lockers/AngleLocker.sol";

// Interface
import "contracts/interfaces/IVeANGLE.sol";
import "contracts/interfaces/ISmartWalletChecker.sol";
import "contracts/interfaces/IAngleGaugeController.sol";
/*
contract AngleTest is BaseTest {
	address internal constant LOCAL_DEPLOYER = address(0xDE);
	address internal constant ALICE = address(0xAA);
	address internal token = Constants.ANGLE;
	address internal veToken = Constants.VEANGLE;
	address internal feeDistributor = Constants.ANGLE_FEE_DITRIBUTOR;
	address internal gaugeController = Constants.ANGLE_GAUGE_CONTROLLER;
	address[] internal rewardsToken;

	uint256 internal constant INITIAL_AMOUNT_TO_LOCK = 10e18;
	uint256 internal constant INITIAL_PERIOD_TO_LOCK = 60 * 60 * 24 * 364 * 4;
	uint256 internal constant EXTRA_AMOUNT_TO_LOCK = 1e18;
	uint256 internal constant EXTRA_PERIOD_TO_LOCK = 60 * 60 * 24 * 364 * 1;
	uint256[] internal rewardsAmount;

	bytes internal BASE = abi.encodeWithSignature("base()");

	AngleLocker internal locker;

	function setUp() public {
		vm.prank(LOCAL_DEPLOYER);
		locker = new AngleLocker(address(this));

		rewardsToken.push(Constants.SAN_USDC_EUR);
		rewardsAmount.push(1e18);

		vm.prank(ISmartWalletChecker(Constants.ANGLE_SMART_WALLET_CHECKER).admin());
		ISmartWalletChecker(Constants.ANGLE_SMART_WALLET_CHECKER).approveWallet(address(locker));
	}

	function testNothing() public {}

	function testLocker01createLock() public {
		bytes memory createLockCallData = abi.encodePacked(
			AngleLocker.createLock.selector,
			INITIAL_AMOUNT_TO_LOCK,
			block.timestamp + INITIAL_PERIOD_TO_LOCK
		);
		createLock(
			LOCAL_DEPLOYER,
			address(locker),
			token,
			veToken,
			INITIAL_AMOUNT_TO_LOCK,
			INITIAL_PERIOD_TO_LOCK,
			createLockCallData
		);
	}

	function testLocker02IncreaseLockAmount() public {
		testLocker01createLock();
		bytes memory increaseAmountCallData = abi.encodePacked(AngleLocker.increaseAmount.selector, EXTRA_AMOUNT_TO_LOCK);
		increaseAmount(
			LOCAL_DEPLOYER,
			address(locker),
			token,
			veToken,
			INITIAL_AMOUNT_TO_LOCK,
			EXTRA_AMOUNT_TO_LOCK,
			increaseAmountCallData
		);
	}

	function testLocker03IncreaseLockDuration() public {
		testLocker01createLock();
		timeJump(EXTRA_PERIOD_TO_LOCK);
		bytes memory increaseLockCallData = abi.encodePacked(
			AngleLocker.increaseUnlockTime.selector,
			block.timestamp + INITIAL_PERIOD_TO_LOCK
		);
		increaseLock(
			LOCAL_DEPLOYER,
			address(locker),
			veToken,
			block.timestamp + INITIAL_PERIOD_TO_LOCK,
			increaseLockCallData
		);
	}

	function testLocker04Release() public {
		testLocker01createLock();
		timeJump(INITIAL_PERIOD_TO_LOCK);
		//bytes memory releaseCallData = abi.encodePacked(BlackpoolLocker.release.selector, address(this));
		bytes memory releaseCallData = abi.encodeWithSignature("release(address)", address(this));
		release(LOCAL_DEPLOYER, address(locker), token, address(this), INITIAL_AMOUNT_TO_LOCK, releaseCallData);
	}

	
	function testLocker05ClaimReward() public {
		testLocker01createLock();
		bytes[] memory listCallData = new bytes[](1);
		address rewardsReceiver = address(this);
		//listCallData[0] = abi.encodePacked(BlackpoolLocker.claimRewards.selector, rewardsToken[0], address(this));
		listCallData[0] = abi.encodeWithSignature("claimRewards(address,address)", rewardsToken[0], rewardsReceiver);
		claimReward(
			LOCAL_DEPLOYER,
			address(locker),
			rewardsToken,
			rewardsAmount,
			feeDistributor,
			rewardsReceiver,
			listCallData
		);
	}

	function testLocker06Execute() public {
		bytes memory data = abi.encodeWithSignature("name()");
		bytes memory executeCallData = abi.encodeWithSignature("execute(address,uint256,bytes)", token, 0, data);
		execute(LOCAL_DEPLOYER, address(locker), executeCallData);
	}

	function testLocker07SetAccumulator() public {
		bytes memory setAccumulatorCallData = abi.encodeWithSignature("setAccumulator(address)", address(0xA));
		bytes memory accumulatorCallData = abi.encodeWithSignature("accumulator()");
		setter(LOCAL_DEPLOYER, address(locker), address(locker), address(0xA), setAccumulatorCallData, accumulatorCallData);
	}

	function testLocker08SetGovernance() public {
		bytes memory setGovernanceCallData = abi.encodeWithSignature("setGovernance(address)", address(0xA));
		bytes memory governanceCallData = abi.encodeWithSignature("governance()");
		setter(LOCAL_DEPLOYER, address(locker), address(locker), address(0xA), setGovernanceCallData, governanceCallData);
	}

	function testLocker09SetDepositor() public {
		bytes memory setDepositorCallData = abi.encodeWithSignature("setAngleDepositor(address)", address(0xA));
		bytes memory depositorCallData = abi.encodeWithSignature("angleDepositor()");
		setter(LOCAL_DEPLOYER, address(locker), address(locker), address(0xA), setDepositorCallData, depositorCallData);
	}

	function testLocker10SetFeeDistributor() public {
		bytes memory setFeeDistributorCallData = abi.encodeWithSignature("setFeeDistributor(address)", address(0xA));
		bytes memory feeDistributorCallData = abi.encodeWithSignature("feeDistributor()");
		setter(
			LOCAL_DEPLOYER,
			address(locker),
			address(locker),
			address(0xA),
			setFeeDistributorCallData,
			feeDistributorCallData
		);
	}

	function testLocker12SetGaugeController() public {
		bytes memory setGaugeControllerCallData = abi.encodeWithSignature("setGaugeController(address)", address(0xA));
		bytes memory gaugeControllerCallData = abi.encodeWithSignature("gaugeController()");
		setter(
			LOCAL_DEPLOYER,
			address(locker),
			address(locker),
			address(0xA),
			setGaugeControllerCallData,
			gaugeControllerCallData
		);
	}

	function testLocker13VoteForGauge() public {
		testLocker01createLock();
		address gauge = IGaugeController(gaugeController).gauges(0);
		bytes memory voteGaugeCallData = abi.encodeWithSignature("voteGaugeWeight(address,uint256)", gauge, 10000);
		voteForGauge(LOCAL_DEPLOYER, address(locker), gaugeController, gauge, voteGaugeCallData);
	}
}
*/
