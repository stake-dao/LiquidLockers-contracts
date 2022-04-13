// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import "../interfaces/ILocker.sol";

contract BaseStrategy {
	/* ========== STATE VARIABLES ========== */
	ILocker locker;
	address governance;
	address rewardsReceiver;
	mapping(address => address) public gauges;
	mapping(address => bool) public vaults;

	/* ========== EVENTS ========== */
	event Deposited(address _gauge, address _token, uint256 _amount);
	event Withdrawn(address _gauge, address _token, uint256 _amount);
	event Claimed(address _gauge);
	event Boosted(address _gauge, address _user);
	event RewardReceiverSet(address _gauge, address _receiver);
	event VaultToggled(address _vault, bool _newState);
	event GaugeSet(address _gauge, address _token);

	/* ========== MODIFIERS ========== */
	modifier onlyGovernance() {
		require(msg.sender == governance, "!governance");
		_;
	}
	modifier onlyApprovedVault() {
		require(vaults[msg.sender], "!approved vault");
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
	function deposit(address _token, uint256 _amount) external virtual onlyApprovedVault {}

	function depositAll(address _token) external virtual onlyGovernance {}

	function withdraw(address _token, uint256 _amount) external virtual onlyApprovedVault {}

	function withdrawAll(address _token) external virtual onlyGovernance {}

	function disableGauge(address _gauge) external virtual onlyGovernance {}

	function boost(address _gauge) external virtual onlyGovernance {}

	function set_rewards_receiver(address _gauge, address _receiver) external virtual onlyGovernance {}

	function claim(address _gauge) external virtual {}

	function toggleVault(address _vault) external virtual onlyGovernance {}

	function setGauge(address _token, address _gauge) external virtual onlyGovernance {}
}
