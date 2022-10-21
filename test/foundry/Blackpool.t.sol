// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
//import "./baseTest/BaseLocker.t.sol";
//import "./baseTest/BaseDepositor.t.sol";
import "./baseTest/Base.t.sol";

// Contracts
import "contracts/lockers/BlackpoolLocker.sol";
import "contracts/tokens/sdToken.sol";
import "contracts/external/ProxyAdmin.sol";
import "contracts/external/TransparentUpgradeableProxy.sol";
import "contracts/depositors/BlackpoolDepositor.sol";

// Interface
import "contracts/interfaces/IVeBPT.sol";
import "contracts/interfaces/ISmartWalletChecker.sol";
import "contracts/interfaces/ILiquidityGauge.sol";

contract BlackpoolTest is BaseTest {
	address internal constant LOCAL_DEPLOYER = address(0xDE);
	address internal constant ALICE = address(0xAA);
	address internal token = Constants.BPT;
	address internal veToken = Constants.VEBPT;
	address internal feeDistributor = Constants.BPT_FEE_DISTRIBUTOR;
	address[] internal rewardsToken;

	uint256 internal constant INITIAL_AMOUNT_TO_LOCK = 10e18;
	uint256 internal constant INITIAL_PERIOD_TO_LOCK = 60 * 60 * 24 * 364 * 4;
	uint256 internal constant EXTRA_AMOUNT_TO_LOCK = 1e18;
	uint256 internal constant EXTRA_PERIOD_TO_LOCK = 60 * 60 * 24 * 364 * 1;
	uint256[] internal rewardsAmount;

	bytes internal BASE = abi.encodeWithSignature("base()");

	sdToken internal sdBPT;
	ProxyAdmin internal proxyAdmin;
	BlackpoolLocker internal locker;
	BlackpoolDepositor internal depositor;
	TransparentUpgradeableProxy internal proxy;
	ILiquidityGauge internal liquidityGauge;
	ILiquidityGauge internal liquidityGaugeImpl;

	function setUp() public {
		vm.startPrank(LOCAL_DEPLOYER);
		locker = new BlackpoolLocker(address(this));
		sdBPT = new sdToken("Stake DAO BPT", "sdBPT");
		liquidityGaugeImpl = ILiquidityGauge(
			deployCode("artifacts/contracts/staking/LiquidityGaugeV4.vy/LiquidityGaugeV4.json")
		);
		bytes memory data = abi.encodeWithSignature(
			"initialize(address,address,address,address,address,address)",
			address(sdBPT),
			LOCAL_DEPLOYER,
			Constants.SDT,
			Constants.VE_SDT,
			Constants.VE_SDT_BOOST_PROXY, // to mock
			Constants.SDT_DISTRIBUTOR // to mock
		);
		proxyAdmin = new ProxyAdmin();
		proxy = new TransparentUpgradeableProxy(address(liquidityGaugeImpl), address(proxyAdmin), data);
		liquidityGauge = ILiquidityGauge(address(proxy));
		depositor = new BlackpoolDepositor(address(Constants.BPT), address(locker), address(sdBPT), Constants.VEBPT);
		vm.stopPrank();

		rewardsToken.push(Constants.WETH);
		rewardsAmount.push(1e18);

		vm.prank(Constants.BPT_DAO);
		ISmartWalletChecker(Constants.BPT_SMART_WALLET_CHECKER).approveWallet(address(locker));

		vm.startPrank(LOCAL_DEPLOYER);
		sdBPT.setOperator(address(depositor));
		locker.setBptDepositor(address(depositor));
		vm.stopPrank();
	}

	////////////////////////////////////////////////////////////////
	/// --- LOCKER
	///////////////////////////////////////////////////////////////

	function testLocker01createLock() public {
		bytes memory createLockCallData = abi.encodePacked(
			BlackpoolLocker.createLock.selector,
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
		bytes memory increaseAmountCallData = abi.encodePacked(
			BlackpoolLocker.increaseAmount.selector,
			EXTRA_AMOUNT_TO_LOCK
		);
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
			BlackpoolLocker.increaseUnlockTime.selector,
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
		//listCallData[0] = abi.encodePacked(BlackpoolLocker.claimRewards.selector, rewardsToken[0], address(this));
		listCallData[0] = abi.encodeWithSignature("claimRewards(address,address)", rewardsToken[0], address(this));
		claimReward(LOCAL_DEPLOYER, address(locker), rewardsToken, rewardsAmount, feeDistributor, listCallData);
	}

	function testLocker06Execute() public {
		bytes memory data = abi.encodeWithSignature("name()");
		bytes memory executeCallData = abi.encodeWithSignature("execute(address,uint256,bytes)", token, 0, data);
		execute(LOCAL_DEPLOYER, address(locker), executeCallData);
	}

	function testLocker07SetAccumulator() public {
		bytes memory setAccumulatorCallData = abi.encodeWithSignature("setAccumulator(address)", address(0xA));
		bytes memory accumulatorCallData = abi.encodeWithSignature("accumulator()");
		setter(LOCAL_DEPLOYER, address(locker), address(0xA), setAccumulatorCallData, accumulatorCallData);
	}

	function testLocker08SetGovernance() public {
		bytes memory setGovernanceCallData = abi.encodeWithSignature("setGovernance(address)", address(0xA));
		bytes memory governanceCallData = abi.encodeWithSignature("governance()");
		setter(LOCAL_DEPLOYER, address(locker), address(0xA), setGovernanceCallData, governanceCallData);
	}

	function testLocker09SetDepositor() public {
		bytes memory setDepositorCallData = abi.encodeWithSignature("setBptDepositor(address)", address(0xA));
		bytes memory depositorCallData = abi.encodeWithSignature("bptDepositor()");
		setter(LOCAL_DEPLOYER, address(locker), address(0xA), setDepositorCallData, depositorCallData);
	}

	function testLocker10SetFeeDistributor() public {
		bytes memory setFeeDistributorCallData = abi.encodeWithSignature("setFeeDistributor(address)", address(0xA));
		bytes memory feeDistributorCallData = abi.encodeWithSignature("feeDistributor()");
		setter(LOCAL_DEPLOYER, address(locker), address(0xA), setFeeDistributorCallData, feeDistributorCallData);
	}

	/*
	////////////////////////////////////////////////////////////////
	/// --- DEPOSITOR
	///////////////////////////////////////////////////////////////
	function testDepositor01LockToken() public {
		lockToken();

		IVeBPT.LockedBalance memory lockedBalanceAfter = IVeBPT(veToken).locked(address(locker));

		assertEq(IERC20(token).balanceOf(address(locker)), 0);
		assertApproxEqRel(lockedBalanceAfter.amount, int256(initialDepositAmount + initialLockAmount), 1e14);
		// Todo : check unlock time increase
	}*/
}
