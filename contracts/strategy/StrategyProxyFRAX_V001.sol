// SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity ^0.8.4;

interface ILiquidLocker {
	function execute(
		address,
		uint256,
		bytes calldata
	) external returns (bool, bytes memory);
}

contract StrategyProxyFRAX_V001 {
	uint256 public value = 12;
	uint256 public day = 1 days;

	IERC20 public token;
	address public liquidLocker;
	address public governance;
	address public lpToken;
	event ExecuteLLCalled(string message);
	event Sender(address sender);

	constructor(address _lpToken, address _liquidLocker) {
		token = IERC20(_lpToken);
		liquidLocker = _liquidLocker;
		governance = msg.sender;
		lpToken = _lpToken;
	}

	function get() public view returns (uint256) {
		return (value);
	}

	function deposit(
		address _to,
		uint256 _amount,
		uint256 _sec
	) public {
		// Transfer LP to Liquid Locker
		token.transferFrom(msg.sender, liquidLocker, _amount);
		console.log(msg.sender);

		// Set approval from Liquid Locker to Frax Staking
		bytes memory _approve = abi.encodeWithSignature("approve(address,uint256)", _to, _amount);
		(bool _successApprove, ) = ILiquidLocker(liquidLocker).execute(address(token), 0, _approve);
		require(_successApprove, "!call approval failed");

		// Interacte with stakeLocked function
		bytes memory _stakeLocked = abi.encodeWithSignature("stakeLocked(uint256,uint256)", _amount, _sec);
		(bool _successStakeLocked, ) = ILiquidLocker(liquidLocker).execute(_to, 0, _stakeLocked);
		require(_successStakeLocked, "!call stakeLocked failed");
	}

	function withdraw(bytes32 _kekid, address _to) public {
		// Interacte with withdrawLocked function
		bytes memory _withdrawLocked = abi.encodeWithSignature("withdrawLocked(bytes32)", _kekid);
		(bool _successWithdraw, ) = ILiquidLocker(liquidLocker).execute(_to, 0, _withdrawLocked);
		require(_successWithdraw, "withdraw failed");
	}
}
