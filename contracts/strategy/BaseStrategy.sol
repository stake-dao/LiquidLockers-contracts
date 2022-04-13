// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import "../interfaces/ILocker.sol";

contract BaseStrategy {
	/* ========== STATE VARIABLES ========== */
	ILocker locker;
	address governance;
	address rewardsReceiver;

	/* ========== EVENTS ========== */
	event Deposited(address _gauge, address _token, uint256 _amount);
	event Withdrawn(address _gauge, address _token, uint256 _amount);
	event Claimed(address _gauge);
	event Boosted(address _gauge, address _user);
	event RewardReceiverSet(address _gauge, address _receiver);

	/* ========== MODIFIERS ========== */
	modifier onlyGovernance() {
		require(msg.sender == governance, "!governance");
		_;
	}

	/* ========== CONSTRUCTOR ========== */
	constructor(
		ILocker _locker,
		address _governance,
		address _receiver
	) public {
		locker = _locker;
		governance = _governance;
		rewardsReceiver = _receiver;
	}

	/* ========== MUTATIVE FUNCTIONS ========== */
	function deposit(
		address _gauge,
		address _token,
		uint256 _amount
	) external virtual onlyGovernance {}

	function depositAll(address _gauge, address _token) external virtual onlyGovernance {}

	function withdraw(
		address _gauge,
		address _token,
		uint256 _amount
	) external virtual onlyGovernance {}

	function withdrawAll(address _gauge, address _token) external virtual onlyGovernance {}

	function disableGauge(address _gauge) external virtual onlyGovernance {}

	function boost(address _gauge) external virtual onlyGovernance {}

	function set_rewards_receiver(address _gauge, address _receiver) external virtual onlyGovernance {}

	function claim(address _gauge) external virtual {}
}
