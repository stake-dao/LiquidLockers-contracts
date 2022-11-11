// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

interface IBaseLocker {
	function governance() external returns (address);

	function accumulator() external returns (address);

	function feeDistributor() external returns (address);

	function gaugeController() external returns (address);

	function depositor() external returns (address);

	function createLock(uint256 _value, uint256 _unlockTime) external;

	function increaseAmount(uint256 _value) external;

	function increaseUnlockTime(uint256 _unlockTime) external;

	function release(address _recipient) external;

	function claimRewards(address _token, address _recipient) external;

	function voteGaugeWeight(address _gauge, uint256 _weight) external;

	function setGovernance(address _governance) external;

	function setFeeDistributor(address _newFD) external;

	function setAccumulator(address _accumulator) external;

	function setDepositor(address _depositor) external;

	function setGaugeController(address _gaugeController) external;

	function execute(
		address to,
		uint256 value,
		bytes calldata data
	) external returns (bool, bytes memory);
}
