pragma solidity 0.8.7;

import '../interfaces/ILiquidityGauge.sol';
contract AngleStrategy {
	function deposit(address to, uint256 amount) external {
        ILiquidityGauge(to).deposit(amount);
    }

	function withdrawLPs(address to, uint256 amount) external {}

	function claim(address to) external {}

	function sendToAccumulator(address to, uint256 amount) external {}
}
