pragma solidity 0.8.7;
import "../interfaces/ILocker.sol";

contract BaseStrategy {
	ILocker locker;
	address governance;
	modifier onlyGovernance() {
		require(msg.sender == governance, "!governance");
		_;
	}

	constructor(ILocker _locker, address _governance) public {
		locker = _locker;
		governance = _governance;
	}

	function deposit(uint256 amount, address gauge) external virtual onlyGovernance {}

	function depositAll(address gauge) external virtual onlyGovernance {}

	function withdraw(uint256 amount, address gauge) external virtual onlyGovernance {}

	function withdrawAll(address gauge) external virtual onlyGovernance {}
}
