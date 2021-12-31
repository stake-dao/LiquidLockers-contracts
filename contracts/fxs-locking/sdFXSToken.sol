// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/// @title sdFXS Token
/// @author StakeDAO
/// @notice A token that represents the FXS deposited by a user into the FXSDepositor
/// @dev Minting & Burning was modified to be used by the operator
contract sdFXSToken is ERC20 {
	using SafeERC20 for IERC20;
	using Address for address;
	using SafeMath for uint256;

	address public operator;

	constructor() public ERC20("Stake DAO FXS", "sdFXS") {
		operator = msg.sender;
	}

	function setOperator(address _operator) external {
		require(msg.sender == operator, "!authorized");
		operator = _operator;
	}

	function mint(address _to, uint256 _amount) external {
		require(msg.sender == operator, "!authorized");
		_mint(_to, _amount);
	}

	function burn(address _from, uint256 _amount) external {
		require(msg.sender == operator, "!authorized");
		_burn(_from, _amount);
	}
}
