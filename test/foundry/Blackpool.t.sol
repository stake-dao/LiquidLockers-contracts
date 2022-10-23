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
		depositor.setGauge(address(liquidityGauge));
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
		setter(LOCAL_DEPLOYER, address(locker), address(locker), address(0xA), setAccumulatorCallData, accumulatorCallData);
	}

	function testLocker08SetGovernance() public {
		bytes memory setGovernanceCallData = abi.encodeWithSignature("setGovernance(address)", address(0xA));
		bytes memory governanceCallData = abi.encodeWithSignature("governance()");
		setter(LOCAL_DEPLOYER, address(locker), address(locker), address(0xA), setGovernanceCallData, governanceCallData);
	}

	function testLocker09SetDepositor() public {
		bytes memory setDepositorCallData = abi.encodeWithSignature("setBptDepositor(address)", address(0xA));
		bytes memory depositorCallData = abi.encodeWithSignature("bptDepositor()");
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

	////////////////////////////////////////////////////////////////
	/// --- DEPOSITOR
	///////////////////////////////////////////////////////////////
	function testDepositor01LockToken() public {
		testLocker01createLock();
		uint256 waitBeforeLock = 60 * 60 * 24 * 80;
		uint256 incentiveAmount = 2e16;
		deal(token, address(depositor), INITIAL_AMOUNT_TO_LOCK);
		bytes memory lockTokenCallData = abi.encodeWithSignature("lockToken()");
		lockToken(
			LOCAL_DEPLOYER,
			address(locker),
			address(depositor),
			token,
			veToken,
			address(sdBPT),
			INITIAL_AMOUNT_TO_LOCK,
			incentiveAmount,
			waitBeforeLock,
			lockTokenCallData
		);
	}

	function testDepositor01LockNoToken() public {
		testLocker01createLock();
		uint256 waitBeforeLock = 60 * 60 * 24 * 80;
		deal(token, address(depositor), 0);
		bytes memory lockTokenCallData = abi.encodeWithSignature("lockToken()");
		lockToken(
			LOCAL_DEPLOYER,
			address(locker),
			address(depositor),
			token,
			veToken,
			address(sdBPT),
			0,
			0,
			waitBeforeLock,
			lockTokenCallData
		);
	}

	function testDepositor02Deposit() public {
		testLocker01createLock();
		uint256 waitBeforeLock = 60 * 60 * 24 * 80;
		uint256 amountToDeposit = 1e18;
		uint256 incentiveAmount = 2e16;
		bool lock = true;
		bool stake = false;
		address user = ALICE;
		bytes memory depositCallData = abi.encodeWithSignature(
			"deposit(uint256,bool,bool,address)",
			amountToDeposit,
			lock,
			stake,
			user
		);
		deposit(
			ALICE,
			address(depositor),
			token,
			address(sdBPT),
			user,
			amountToDeposit,
			incentiveAmount,
			waitBeforeLock,
			lock,
			stake,
			depositCallData
		);
	}

	function testDepositor03SetGovernance() public {
		bytes memory setGovernanceCallData = abi.encodeWithSignature("setGovernance(address)", address(0xA));
		bytes memory governanceCallData = abi.encodeWithSignature("governance()");
		setter(
			LOCAL_DEPLOYER,
			address(depositor),
			address(depositor),
			address(0xA),
			setGovernanceCallData,
			governanceCallData
		);
	}

	function testDepositor04SetSdTokenOperator() public {
		bytes memory setSdTokenOperatorCallData = abi.encodeWithSignature("setSdTokenOperator(address)", address(0xA));
		bytes memory sdTokenOperatorCallData = abi.encodeWithSignature("operator()");
		setter(
			LOCAL_DEPLOYER,
			address(depositor),
			address(sdBPT),
			address(0xA),
			setSdTokenOperatorCallData,
			sdTokenOperatorCallData
		);
	}

	function testDepositor05SetRelock() public {
		bytes memory setRelockCallData = abi.encodeWithSignature("setRelock(bool)", false);
		bytes memory relockCallData = abi.encodeWithSignature("relock()");
		setter(LOCAL_DEPLOYER, address(depositor), address(depositor), false, setRelockCallData, relockCallData);
	}

	function testDepositor06SetGauge() public {
		bytes memory setGaugeCallData = abi.encodeWithSignature("setGauge(address)", address(0xA));
		bytes memory gaugeCallData = abi.encodeWithSignature("gauge()");
		setter(LOCAL_DEPLOYER, address(depositor), address(depositor), address(0xA), setGaugeCallData, gaugeCallData);
	}

	function testDepositor07SetFees() public {
		bytes memory setFeesCallData = abi.encodeWithSignature("setFees(uint256)", 10);
		bytes memory feesCallData = abi.encodeWithSignature("lockIncentive()");
		setter(LOCAL_DEPLOYER, address(depositor), address(depositor), 10, setFeesCallData, feesCallData);
	}

	////////////////////////////////////////////////////////////////
	/// --- SDTOKEN
	///////////////////////////////////////////////////////////////
	function testSdToken01Mint() public {
		address to = ALICE;
		uint256 mintAmount = 1e18;
		bytes memory mintCallData = abi.encodeWithSignature("mint(address,uint256)", to, mintAmount);
		mint(address(depositor), address(sdBPT), to, mintAmount, mintCallData);
	}

	function testSdToken02Burn() public {
		testSdToken01Mint();
		address from = ALICE;
		uint256 burnAmount = 1e18;
		bytes memory burnCallData = abi.encodeWithSignature("burn(address,uint256)", from, burnAmount);
		burn(address(depositor), address(sdBPT), from, burnAmount, burnCallData);
	}

	function testSdToken03SetOperator() public {
		bytes memory setOperatorCallData = abi.encodeWithSignature("setOperator(address)", address(0xA));
		bytes memory operatorCallData = abi.encodeWithSignature("operator()");
		setter(address(depositor), address(sdBPT), address(sdBPT), address(0xA), setOperatorCallData, operatorCallData);
	}

	////////////////////////////////////////////////////////////////
	/// --- HELPERS
	///////////////////////////////////////////////////////////////
}
