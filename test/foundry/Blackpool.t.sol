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
		createLock(address(locker), token, veToken, INITIAL_AMOUNT_TO_LOCK, INITIAL_PERIOD_TO_LOCK, BASE);
	}

	function testLocker01createLockSignature() public {
		bytes memory data = abi.encodeWithSignature(
			"createLock(uint256,uint256)",
			INITIAL_AMOUNT_TO_LOCK,
			block.timestamp + (INITIAL_PERIOD_TO_LOCK)
		);
		createLock(address(locker), token, veToken, INITIAL_AMOUNT_TO_LOCK, INITIAL_PERIOD_TO_LOCK, data);
	}

	function testLocker02IncreaseLockAmount() public {
		increaseAmount(
			address(locker),
			token,
			veToken,
			INITIAL_AMOUNT_TO_LOCK,
			INITIAL_PERIOD_TO_LOCK,
			EXTRA_AMOUNT_TO_LOCK,
			BASE,
			BASE
		);
	}

	function testLocker02IncreaseLockAmountSignature01() public {
		bytes memory createLockSign = abi.encodeWithSignature(
			"createLock(uint256,uint256)",
			INITIAL_AMOUNT_TO_LOCK,
			block.timestamp + (INITIAL_PERIOD_TO_LOCK)
		);
		increaseAmount(
			address(locker),
			token,
			veToken,
			INITIAL_AMOUNT_TO_LOCK,
			INITIAL_PERIOD_TO_LOCK,
			EXTRA_AMOUNT_TO_LOCK,
			createLockSign,
			BASE
		);
	}

	function testLocker02IncreaseLockAmountSignature02() public {
		bytes memory increaseAmountSign = abi.encodeWithSignature("increaseAmount(uint256)", EXTRA_AMOUNT_TO_LOCK);
		increaseAmount(
			address(locker),
			token,
			veToken,
			INITIAL_AMOUNT_TO_LOCK,
			INITIAL_PERIOD_TO_LOCK,
			EXTRA_AMOUNT_TO_LOCK,
			BASE,
			increaseAmountSign
		);
	}

	function testLocker02IncreaseLockAmountSignature03() public {
		bytes memory createLockSign = abi.encodeWithSignature(
			"createLock(uint256,uint256)",
			INITIAL_AMOUNT_TO_LOCK,
			block.timestamp + (INITIAL_PERIOD_TO_LOCK)
		);
		bytes memory increaseAmountSign = abi.encodeWithSignature("increaseAmount(uint256)", EXTRA_AMOUNT_TO_LOCK);
		increaseAmount(
			address(locker),
			token,
			veToken,
			INITIAL_AMOUNT_TO_LOCK,
			INITIAL_PERIOD_TO_LOCK,
			EXTRA_AMOUNT_TO_LOCK,
			createLockSign,
			increaseAmountSign
		);
	}

	function testLocker03IncreaseLockDuration() public {
		increaseLock(
			address(locker),
			token,
			veToken,
			INITIAL_AMOUNT_TO_LOCK,
			INITIAL_PERIOD_TO_LOCK,
			EXTRA_PERIOD_TO_LOCK,
			BASE,
			BASE
		);
	}

	function testLocker04Release() public {
		release(address(locker), token, veToken, INITIAL_AMOUNT_TO_LOCK, INITIAL_PERIOD_TO_LOCK, BASE, BASE);
	}

	function testLocker05ClaimReward() public {
		claimReward(
			address(locker),
			token,
			veToken,
			INITIAL_AMOUNT_TO_LOCK,
			INITIAL_PERIOD_TO_LOCK,
			rewardsToken,
			rewardsAmount,
			feeDistributor,
			BASE,
			BASE
		);
	}

	function testLocker06Execute() public {
		bytes memory data = abi.encodeWithSignature("name()");
		bytes memory signature = abi.encodeWithSignature("execute(address,uint256,bytes)", token, 0, data);
		execute(address(locker), token, 0, data, signature);
	}

	function testLocker07SetAccumulator() public {
		setAccumulator(address(locker), BASE, BASE);
	}

	function testLocker08SetGovernance() public {
		setGovernance(address(locker), BASE, BASE);
	}

	function testLocker09SetDepositor() public {
		bytes memory setterFuncSign = abi.encodeWithSignature("setBptDepositor(address)", address(0xA));
		bytes memory setterSign = abi.encodeWithSignature("bptDepositor()");
		setDepositor(address(locker), setterFuncSign, setterSign);
	}

	function testLocker10SetFeeDistributor() public {
		setFeeDistributor(address(locker), BASE, BASE);
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
