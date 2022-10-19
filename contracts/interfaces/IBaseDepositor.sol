// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

interface IBaseDepositor {
	function setGovernance(address _governance) external;

	function setSdTokenOperator(address _operator) external;

	function setRelock(bool _relock) external;

	function setGauge(address _gauge) external;

	function setFees(uint256 _lockIncentive) external;

	function lockToken() external;

	function deposit(
		uint256 _amount,
		bool _lock,
		bool _stake,
		address _user
	) external;

	function depositAll(
		bool _lock,
		bool _stake,
		address _user
	) external;

	function governance() external view returns (address);
}
