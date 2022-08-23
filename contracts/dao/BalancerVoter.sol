// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;
import "../BalancerLocker.sol";

contract BalancerVoter {
	address public constant balancerLocker = 0xea79d1A83Da6DB43a85942767C389fE0ACf336A5;
	address public constant balancerGaugeController = 0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD;
	address public governance;

	constructor() {
		governance = msg.sender;
	}

	function voteGauges(address[] calldata _gauges, uint256[] calldata _weights) external {
		require(msg.sender == governance, "!governance");
		require(_gauges.length == _weights.length, "!length");
		uint256 length = _gauges.length;
		for (uint256 i; i < length; i++) {
			BalancerLocker(balancerLocker).voteGaugeWeight(_gauges[i], _weights[i]);
		}
	}

	/// @notice execute a function
	/// @param _to Address to sent the value to
	/// @param _value Value to be sent
	/// @param _data Call function data
	function execute(
		address _to,
		uint256 _value,
		bytes calldata _data
	) external returns (bool, bytes memory) {
		require(msg.sender == governance, "!governance");
		(bool success, bytes memory result) = _to.call{ value: _value }(_data);
		return (success, result);
	}

	/// @notice execute a function and transfer funds to the given address
	/// @param _to Address to sent the value to
	/// @param _value Value to be sent
	/// @param _data Call function data
	/// @param _token address of the token that we will transfer
	/// @param _recipient address of the recipient that will get the tokens
	function executeAndTransfer(
		address _to,
		uint256 _value,
		bytes calldata _data,
		address _token,
		address _recipient
	) external returns (bool, bytes memory) {
		require(msg.sender == governance, "!governance");
		(bool success, bytes memory result) = _to.call{ value: _value }(_data);
		require(success, "!success");
		uint256 tokenBalance = IERC20(_token).balanceOf(balancerLocker);
		bytes memory transferData = abi.encodeWithSignature("transfer(address,uint256)", _recipient, tokenBalance);
		(success, ) = BalancerLocker(balancerLocker).execute(_token, 0, transferData);
		require(success, "transfer failed");
		return (success, result);
	}

	/* ========== SETTERS ========== */
	function setGovernance(address _newGovernance) external {
		require(msg.sender == governance, "!governance");
		governance = _newGovernance;
	}
}
