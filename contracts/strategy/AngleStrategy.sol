pragma solidity 0.8.7;

import "./BaseStrategy.sol";

contract AngleStrategy is BaseStrategy {
	constructor(ILocker _locker, address _governance) BaseStrategy(_locker, _governance) {}

	function deposit(uint256 amount, address gauge) external override onlyGovernance {
		locker.execute(gauge, 0, abi.encodeWithSignature("deposit(uint256)", amount));
	}

	function depositAll(address gauge) external override onlyGovernance {
		locker.execute(
			gauge,
			0,
			abi.encodeWithSignature(
				"deposit(uint256)",
				0 // Get the balance of
			)
		);
	}

	function withdraw(uint256 amount, address gauge) external override onlyGovernance {
		locker.execute(gauge, 0, abi.encodeWithSignature("withdraw(uint256)", amount));
	}

	function withdrawAll(address gauge) external override onlyGovernance {
		locker.execute(
			gauge,
			0,
			abi.encodeWithSignature(
				"withdraw(uint256)",
				0 // Get the balance of
			)
		);
	}

	function sendToAccumulator(address to, uint256 amount) external {}
}
