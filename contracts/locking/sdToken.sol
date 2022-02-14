// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title sdToken
/// @author StakeDAO
/// @notice A token that represents the Token deposited by a user into the Depositor
/// @dev Minting & Burning was modified to be used by the operator
contract sdToken is ERC20 {
	address public operator;

	constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
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
