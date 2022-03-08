// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IVeSDT.sol";
/// @title sdToken
/// @author StakeDAO
/// @notice A token that represents the Token deposited by a user into the Depositor
/// @dev Minting & Burning was modified to be used by the operator
contract sdCRV is ERC20 {
	address public operator;
    address public constant SD_VE_CRV = 0x478bBC744811eE8310B461514BDc29D03739084D;
	address public constant VE_CRV = 0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2;
	address public constant DAO = 0x2d95A6D0ee4cD129f8f0b0ec91961D51Fb33fFd6;
	constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
		operator = msg.sender;

        uint256 lockerBalance = ERC20(SD_VE_CRV).totalSupply();
		IVeSDT.LockedBalance memory lockedBalance = IVeSDT(VE_CRV).locked(0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6);
		uint256 toMint = uint256(uint128(lockedBalance.amount)) - lockerBalance;
		_mint(DAO, toMint);
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
