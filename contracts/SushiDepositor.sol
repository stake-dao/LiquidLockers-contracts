// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/// @title Contract that accepts SUSHI token and locks or stakes them
/// @author StakeDAO
contract SushiDepositor {
	using SafeERC20 for IERC20;
	using Address for address;

  /* ========== STATE VARIABLES ========== */
	address public constant sushi = address(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2);

	address public governance;
	address public gauge;

	/* ========== EVENTS ========== */
	event GovernanceChanged(address indexed newGovernance);
	event GaugeChanged(address indexed newGauge);
  /* ========== CONSTRUCTOR ========== */
	constructor() public {
		governance = msg.sender;
	}

  /* ========== RESTRICTED FUNCTIONS ========== */
	function setGauge(address _gauge) external {
		require(msg.sender == governance, "!auth");
		gauge = _gauge;
		emit GaugeChanged(_gauge);
	}

	/// @notice Deposits SUSHI for a user
	/// @dev The amount of SUSHI should be approved before calling this function
	/// @param _account The address for which to make a deposit
	/// @param _amount The amount to be deposited
	function depositFor(address _account, uint256 _amount) public {
		require(_amount > 0, "!>0");
		require(gauge != address(0), "!gauge");
		IERC20(sushi).safeTransferFrom(msg.sender, address(this), _amount);
	}
}
