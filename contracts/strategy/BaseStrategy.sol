pragma solidity 0.8.7;
import "../interfaces/ILocker.sol";

contract BaseStrategy {
	/* ========== STATE VARIABLES ========== */
	ILocker locker;
	address governance;

	/* ========== MODIFIERS ========== */
	modifier onlyGovernance() {
		require(msg.sender == governance, "!governance");
		_;
	}

	/* ========== CONSTRUCTOR ========== */
	constructor(ILocker _locker, address _governance) public {
		locker = _locker;
		governance = _governance;
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

	function boost(address _gauge) external {}

	function set_rewards_receiver(address _receiver, address _gauge) external virtual onlyGovernance {}
}
