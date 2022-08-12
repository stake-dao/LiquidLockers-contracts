// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../interfaces/ITokenMinter.sol";
import "../interfaces/ILocker.sol";
import "../interfaces/IGaugeMultiRewards.sol";
import "../interfaces/ISdFXS.sol";

/// @title Contract that accepts FXS token and locks or stakes them
/// @author StakeDAO
contract FxsDepositor {
	using SafeERC20 for IERC20;
	using Address for address;
	using SafeMath for uint256;

  /* ========== STATE VARIABLES ========== */
	address public constant fxs = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);
	uint256 private constant MAXTIME = 4 * 364 * 86400; //364 days is divisible by 7 (week) to max precision
	uint256 private constant WEEK = 7 * 86400;

	uint256 public lockIncentive = 10; //incentive to users who spend gas to lock fxs
	uint256 public constant FEE_DENOMINATOR = 10000;

	address public governance;
	address public immutable locker;
	address public immutable minter;
	address public gauge;
	uint256 public incentiveFxs = 0;
	uint256 public unlockTime;
	bool public relock = true;

	/* ========== EVENTS ========== */
	event Deposited(address indexed user, uint256 indexed amount, bool stake, bool lock);
	event IncentiveReceived(address indexed user, uint256 indexed amount);
	event FXSLocked(address indexed user, uint256 indexed amount);
	event DepositedFor(address indexed user, uint256 indexed amount);
	event GovernanceChanged(address indexed newGovernance);
	event GaugeChanged(address indexed newGauge);
	event SdFXSOperatorChanged(address indexed newSdFXS);
	event FeesChanged(uint256 newFee);
  /* ========== CONSTRUCTOR ========== */
	constructor(address _locker, address _minter) public {
		governance = msg.sender;
		locker = _locker;
		minter = _minter;
	}

  /* ========== RESTRICTED FUNCTIONS ========== */
	function setGovernance(address _governance) external {
		require(msg.sender == governance, "!auth");
		governance = _governance;
		emit GovernanceChanged(_governance);

	}

	function setSdFXSOperator(address _operator) external {
		require(msg.sender == governance, "!auth");
		ISdFXS(minter).setOperator(_operator);
		emit SdFXSOperatorChanged(_operator);
	}

	function setGauge(address _gauge) external {
		require(msg.sender == governance, "!auth");
		gauge = _gauge;
		emit GaugeChanged(_gauge);
	}

	function setRelock(bool _relock) external {
		require(msg.sender == governance, "!auth");
		relock = _relock;
	}

	function setFees(uint256 _lockIncentive) external {
		require(msg.sender == governance, "!auth");

		if (_lockIncentive >= 0 && _lockIncentive <= 30) {
			lockIncentive = _lockIncentive;
			emit FeesChanged(_lockIncentive);
		}
	}

  /* ========== MUTATIVE FUNCTIONS ========== */

	/// @notice Locks the FXS held by the contract
	/// @dev The contract must have FXS to lock
	function _lockFXS() internal {
		uint256 fxsBalance = IERC20(fxs).balanceOf(address(this));

		// If there is FXS available in the contract transfer it to the locker
		if (fxsBalance > 0) {
			IERC20(fxs).safeTransfer(locker, fxsBalance);
			emit FXSLocked(msg.sender, fxsBalance);
		}

		uint256 fxsBalanceStaker = IERC20(fxs).balanceOf(locker);
		// If the locker has no FXS then return
		if (fxsBalanceStaker == 0) {
			return;
		}

		ILocker(locker).increaseAmount(fxsBalanceStaker);

		if (relock) {
			uint256 unlockAt = block.timestamp + MAXTIME;
			uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

			if (unlockInWeeks.sub(unlockTime) > 2) {
				ILocker(locker).increaseUnlockTime(unlockAt);
				unlockTime = unlockInWeeks;
			}
		}
	}

	/// @notice Lock FXS held by the contract
	/// @dev The contract must have FXS to lock
	function lockFXS() external {
		_lockFXS();

		// If there is incentive available give it to the user calling lockFXS
		if (incentiveFxs > 0) {
			ITokenMinter(minter).mint(msg.sender, incentiveFxs);
			emit IncentiveReceived(msg.sender, incentiveFxs);
			incentiveFxs = 0;
		}
	}

	/// @notice Deposit & Lock or Stake FXS
	/// @dev User needs to approve the contract to transfer the FXS token
	/// @param _amount The amount of fxs to deposit
	/// @param _lock Whether to lock the fxs
	/// @param _stake Whether to stake the fxs
	function deposit(
		uint256 _amount,
		bool _lock,
		bool _stake
	) public {
		require(_amount > 0, "!>0");
		require(gauge != address(0), "!gauge");

		// If User chooses to lock FXS
		if (_lock) {
			IERC20(fxs).safeTransferFrom(msg.sender, locker, _amount);
			_lockFXS();

			if (incentiveFxs > 0) {
				_amount = _amount.add(incentiveFxs);
				emit IncentiveReceived(msg.sender, incentiveFxs);
				incentiveFxs = 0;
			}
		} else {
			//move tokens here
			IERC20(fxs).safeTransferFrom(msg.sender, address(this), _amount);
			//defer lock cost to another user
			uint256 callIncentive = _amount.mul(lockIncentive).div(FEE_DENOMINATOR);
			_amount = _amount.sub(callIncentive);
			incentiveFxs = incentiveFxs.add(callIncentive);
		}

		if (!_stake) {
			ITokenMinter(minter).mint(msg.sender, _amount);
		} else {
			// If user chooses to stake FXS send it to the gauge and then stake it
			ITokenMinter(minter).mint(address(this), _amount);
			IERC20(minter).safeApprove(gauge, 0);
			IERC20(minter).safeApprove(gauge, _amount);
			IGaugeMultiRewards(gauge).stakeFor(msg.sender, _amount);
		}
		emit Deposited(msg.sender, _amount, _stake, _lock);
	}

	/// @notice Deposits & stakes FXS for a user
	/// @dev The amount of FXS should be approved before calling this function
	/// @param _account The address for which to make a deposit
	/// @param _amount The amount to be deposited
	function depositFor(address _account, uint256 _amount) public {
		require(_amount > 0, "!>0");
		require(gauge != address(0), "!gauge");
		IERC20(fxs).safeTransferFrom(msg.sender, locker, _amount);
		_lockFXS();

		if (incentiveFxs > 0) {
			_amount = _amount.add(incentiveFxs);
			emit IncentiveReceived(_account, incentiveFxs);
			incentiveFxs = 0;
		}

		// Mint sdFXS equal to the amount of FXS being deposited
		ITokenMinter(minter).mint(address(this), _amount);
		// Approve the sdFXS to the gaugemultireward and then stake
		IERC20(minter).safeApprove(gauge, 0);
		IERC20(minter).safeApprove(gauge, _amount);
		IGaugeMultiRewards(gauge).stakeFor(_account, _amount);

		emit DepositedFor(_account, _amount);
	}

	/// @notice Deposits all the FXS token of a user & locks or stakes them based on the options choosen
	/// @dev User needs to approve the contract to transfer FXS tokens
	/// @param _lock Whether to lock the fxs
	/// @param _stake Whether to stake the fxs
	function depositAll(bool _lock, bool _stake) external {
		uint256 fxsBal = IERC20(fxs).balanceOf(msg.sender);
		deposit(fxsBal, _lock, _stake);
	}
}
