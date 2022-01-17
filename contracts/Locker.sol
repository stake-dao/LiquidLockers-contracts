// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IVeToken.sol";
import "./interfaces/IYieldDistributor.sol";
import "./interfaces/ITokenGaugeController.sol";

/// @title Locker
/// @author StakeDAO
/// @notice Locks the tokens to veToken contract
contract Locker {
	using SafeERC20 for IERC20;
	using Address for address;
	using SafeMath for uint256;

	/* ========== STATE VARIABLES ========== */
	address public governance;
	address public tokenDepositor;
	address public accumulator;

    address public token;
    address public veToken;
    address public yieldDistributor;
    address public gaugeController;

	/* ========== EVENTS ========== */
	event LockCreated(address indexed user, uint256 value, uint256 duration);
	event TokenClaimed(address indexed user, uint256 value);
	event Voted(uint256 _voteId, address indexed _votingAddress, bool _support);
	event VotedOnGaugeWeight(address indexed _gauge, uint256 _weight);
	event Released(address indexed user, uint256 value);
	event GovernanceChanged(address indexed newGovernance);
	event TokenDepositorChanged(address indexed newTokenDepositor);
	event AccumulatorChanged(address indexed newAccumulator);
	event YieldDistributorChanged(address indexed newYieldDistributor);
	event GaugeControllerChanged(address indexed newGaugeController);
  
	/* ========== CONSTRUCTOR ========== */
	constructor(
        address _token, 
        address _veToken,
        address _gaugeController,
        address _yieldDistributor,
        address _accumulator
    ) public {
		governance = msg.sender;
		accumulator = _accumulator;
        token = _token;
        veToken = _veToken;
        gaugeController = _gaugeController;
        yieldDistributor = _yieldDistributor;
		IERC20(token).approve(veToken, type(uint256).max);
	}

	/* ========== MODIFIERS ========== */
	modifier onlyGovernance() {
		require(msg.sender == governance, "!gov");
		_;
	}

	modifier onlyGovernanceOrAcc() {
		require(msg.sender == governance || msg.sender == accumulator, "!(gov||acc)");
		_;
	}

	modifier onlyGovernanceOrDepositor() {
		require(
			msg.sender == governance || msg.sender == tokenDepositor,
			"!(gov||proxy||tokenDepositor)"
		);
		_;
	}

	/* ========== MUTATIVE FUNCTIONS ========== */
	/// @notice Creates a lock by locking token in the veToken contract for the specified time
	/// @dev Can only be called by governance or proxy
	/// @param _value The amount of token to be locked
	/// @param _unlockTime The duration for which the token is to be locked
	function createLock(uint256 _value, uint256 _unlockTime) external onlyGovernanceOrDepositor {
		IVeToken(veToken).create_lock(_value, _unlockTime);
		IYieldDistributor(yieldDistributor).checkpoint();
		emit LockCreated(msg.sender, _value, _unlockTime);
	}

	/// @notice Increases the amount of tokken locked in veToken
	/// @dev The tokens needs to be transferred to this contract before calling
	/// @param _value The amount by which the lock amount is to be increased
	function increaseAmount(uint256 _value) external onlyGovernanceOrDepositor {
		IVeToken(veToken).increase_amount(_value);
		IYieldDistributor(yieldDistributor).checkpoint();
	}

	/// @notice Increases the duration for which token is locked in veToken contract for the user calling the function
	/// @param _unlockTime The duration in seconds for which the token is to be locked
	function increaseUnlockTime(uint256 _unlockTime) external onlyGovernanceOrDepositor {
		IVeToken(veToken).increase_unlock_time(_unlockTime);
		IYieldDistributor(yieldDistributor).checkpoint();
	}

	/// @notice Claim the token reward from the token Yield Distributor
	/// @param _recipient The address which will receive the claimed tokens reward
	function claimTokenRewards(address _recipient) external onlyGovernanceOrAcc {
		IYieldDistributor(yieldDistributor).getYield();
		emit TokenClaimed(_recipient, IERC20(token).balanceOf(address(this)));
		IERC20(token).safeTransfer(_recipient, IERC20(token).balanceOf(address(this)));
	}

	/// @notice Withdraw the tokens from veToken contract
	/// @dev call only after lock time expires
	/// @param _recipient The address which will receive the released tokens
	function release(address _recipient) external onlyGovernanceOrDepositor {
		IVeToken(veToken).withdraw();
		uint balance = IERC20(token).balanceOf(address(this));
		
		IERC20(token).safeTransfer(_recipient, balance);
		emit Released(_recipient, balance);
	}

	/// @notice Vote on Token Gauge Controller for a gauge with a given weight
	/// @param _gauge The gauge address to vote for
	/// @param _weight The weight with which to vote
	function voteGaugeWeight(address _gauge, uint256 _weight) external onlyGovernance {
		ITokenGaugeController(gaugeController).vote_for_gauge_weights(_gauge, _weight);
		emit VotedOnGaugeWeight(_gauge, _weight);
	}
	
	function setGovernance(address _governance) external onlyGovernance {
		governance = _governance;
		emit GovernanceChanged(_governance);
	}

	function setTokenDepositor(address _tokenDepositor) external onlyGovernance {
		tokenDepositor = _tokenDepositor;
		emit TokenDepositorChanged(_tokenDepositor);
	}

	function setYieldDistributor(address _newYD) external onlyGovernance {
		yieldDistributor = _newYD;
		emit YieldDistributorChanged(_newYD);
	}

	function setGaugeController(address _gaugeController) external onlyGovernance {
		gaugeController = _gaugeController;
		emit GaugeControllerChanged(_gaugeController);
	}

	function setAccumulator(address _accumulator) external onlyGovernance {
		accumulator = _accumulator;
		emit AccumulatorChanged(_accumulator);
	}

	/// @notice execute a function
	/// @param to Address to sent the value to
	/// @param value Value to be sent
	/// @param data Call function data
	function execute(
		address to,
		uint256 value,
		bytes calldata data
	) external onlyGovernanceOrDepositor returns (bool, bytes memory) {
		(bool success, bytes memory result) = to.call{ value: value }(data);
		return (success, result);
	}
}
