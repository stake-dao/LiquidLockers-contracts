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

	sdToken internal sdBPT;
	ProxyAdmin internal proxyAdmin;
	BlackpoolLocker internal blackpoolLocker;
	BlackpoolDepositor internal blackpoolDepositor;
	TransparentUpgradeableProxy internal proxy;
	ILiquidityGauge internal liquidityGauge;
	ILiquidityGauge internal liquidityGaugeImpl;

	function setUp() public {
		vm.startPrank(LOCAL_DEPLOYER);
		blackpoolLocker = new BlackpoolLocker(address(this));
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
		blackpoolDepositor = new BlackpoolDepositor(
			address(Constants.BPT),
			address(blackpoolLocker),
			address(sdBPT),
			Constants.VEBPT
		);
		vm.stopPrank();

		address[] memory rewardsToken = new address[](1);
		rewardsToken[0] = Constants.WETH;

		uint256[] memory rewardsAmount = new uint256[](1);
		rewardsAmount[0] = 1e18;

		initBase(
			// Token to lock address
			Constants.BPT,
			// veToken address
			Constants.VEBPT,
			// Liquid Locker address
			address(blackpoolLocker),
			// Depositor address
			address(blackpoolDepositor),
			// Wrapper address
			address(sdBPT),
			// rewards token list
			rewardsToken,
			// Fee/yield distributor address
			Constants.BPT_FEE_DISTRIBUTOR,
			// Initial amount to lock
			1e18,
			// Initial period to lock
			125_798_400,
			// Initial user deposit amount
			1e18,
			// Extra amount to lock
			1e16,
			// Extra period to lock
			31_449_600,
			// Amount for each rewards
			rewardsAmount
		);

		vm.prank(Constants.BPT_DAO);
		ISmartWalletChecker(Constants.BPT_SMART_WALLET_CHECKER).approveWallet(address(locker));

		vm.startPrank(LOCAL_DEPLOYER);
		sdBPT.setOperator(depositor);
		blackpoolLocker.setBptDepositor(depositor);
		vm.stopPrank();
	}

	////////////////////////////////////////////////////////////////
	/// --- LOCKER
	///////////////////////////////////////////////////////////////
	function testLocker01createLock() public {
		createLock();

		IVeBPT.LockedBalance memory lockedBalance = IVeBPT(veToken).locked(address(locker));

		assertEq(lockedBalance.amount, int256(initialLockAmount));
		assertEq(lockedBalance.end, ((block.timestamp + initialLockTime) / Constants.WEEK) * Constants.WEEK);
		assertApproxEqRel(IVeBPT(veToken).balanceOf(address(locker)), initialLockAmount, 1e16); // 1% Margin of Error
	}

	function testLocker02IncreaseLockAmount() public {
		increaseAmount();

		IVeBPT.LockedBalance memory lockedBalance = IVeBPT(veToken).locked(address(locker));
		assertApproxEqRel(lockedBalance.amount, int256(initialLockAmount + extraLockAmount), 0);
	}

	function testLocker03IncreaseLockDuration() public {
		increaseLock();

		IVeBPT.LockedBalance memory lockedBalance = IVeBPT(veToken).locked(address(locker));
		assertApproxEqRel(lockedBalance.end, ((block.timestamp + initialLockTime) / Constants.WEEK) * Constants.WEEK, 0);
	}

	function testLocker04Release() public {
		release();
		assertEq(IERC20(token).balanceOf(address(this)), initialLockAmount);
	}

	function testLocker05ClaimReward() public {
		uint256 balanceBefore = IERC20(Constants.WETH).balanceOf(address(this));

		claimReward();

		assertEq(balanceBefore, 0);
		assertGt(IERC20(Constants.WETH).balanceOf(address(this)), balanceBefore);
	}

	function testLocker06Execute() public {
		bool success = execute();

		assertEq(success, true);
	}

	function testLocker07Setters() public {
		setters();

		assertEq(IBaseLocker(locker).accumulator(), address(0xA));
		assertEq(IBaseLocker(locker).governance(), address(0xA));
	}

	function testLocker08Extra01() public {
		vm.startPrank(IBaseLocker(locker).governance());
		blackpoolLocker.setBptDepositor(address(0xA));
		blackpoolLocker.setFeeDistributor(address(0xA));
		vm.stopPrank();

		assertEq(blackpoolLocker.bptDepositor(), address(0xA));
		assertEq(blackpoolLocker.feeDistributor(), address(0xA));
	}

	////////////////////////////////////////////////////////////////
	/// --- DEPOSITOR
	///////////////////////////////////////////////////////////////
	function testDepositor01LockToken() public {
		lockToken();

		IVeBPT.LockedBalance memory lockedBalanceAfter = IVeBPT(veToken).locked(address(locker));

		assertEq(IERC20(token).balanceOf(address(locker)), 0);
		assertApproxEqRel(lockedBalanceAfter.amount, int256(initialDepositAmount + initialLockAmount), 1e14);
		// Todo : check unlock time increase
	}
}
