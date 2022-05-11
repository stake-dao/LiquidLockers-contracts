// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import "../interfaces/ILocker.sol";

contract BaseStrategyV2 {
	/* ========== STATE VARIABLES ========== */
	ILocker locker;
	address public governance;
	address public rewardsReceiver;
	address public veSDTFeeProxy;
	address public vaultGaugeFactory;
	uint256 public constant BASE_FEE = 10000;
	mapping(address => address) public gauges;
	mapping(address => bool) public vaults;
	mapping(address => uint256) public perfFee; // gauge -> fee
    mapping(address => uint256) public accumulatorFee; // gauge -> fee
    mapping(address => uint256) public claimerRewardFee; // gauge -> fee
    mapping(address => uint256) public veSDTFee; // gauge -> fee
	mapping(address => address) public multiGauges;

	/* ========== EVENTS ========== */
	event Deposited(address _gauge, address _token, uint256 _amount);
	event Withdrawn(address _gauge, address _token, uint256 _amount);
	event Claimed(address _gauge, address _token, uint256 _amount);
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
	modifier onlyGovernanceOrFactory() {
		require(msg.sender == governance || msg.sender == vaultGaugeFactory, "!governance && !factory");
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

	function withdraw(address _token, uint256 _amount) external virtual onlyApprovedVault {}

	function disableGauge(address _gauge) external virtual onlyGovernance {}

	function boost(address _gauge) external virtual onlyGovernance {}

	function set_rewards_receiver(address _gauge, address _receiver) external virtual onlyGovernance {}

	function claim(address _gauge) external virtual {}

	function toggleVault(address _vault) external virtual onlyGovernanceOrFactory {}

	function setGauge(address _token, address _gauge) external virtual onlyGovernanceOrFactory {}

	function setMultiGauge(address _gauge, address _multiGauge) external virtual onlyGovernanceOrFactory {}
}
