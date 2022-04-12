// SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

pragma solidity ^0.8.4;

interface ILiquidLocker {
	function execute(
		address,
		uint256,
		bytes calldata
	) external returns (bool, bytes memory);
}

contract StrategyProxyFRAX {
	address public governance;
	address public constant LIQUIDLOCKER = 0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f;

	mapping(address => LPInformations) public lpInfos;
	mapping(address => bytes32[]) public kekIdUser;
	mapping(address => uint256[]) public tokenIdUser;

	struct LPInformations {
		address lpLocker;
		address[] rewards;
		uint256 lpType; // 0: ERC20 or 1: ERC721, find something better!!
		uint256 stakeLockedType; // 0: "stakeLocked(uint256,uint256)"
		uint256 withdrawLockedType;
	}

	/* ==== Constructor ==== */
	constructor() {
		governance = msg.sender;
	}

	/* ==== Modifier ==== */
	modifier onlyGovernance() {
		require(msg.sender == governance, "!gov");
		_;
	}

	/* ==== Only Governance ==== */
	function setLPInfos(
		address _lpToken,
		address _lpLocker,
		address[] memory _rewards,
		uint256 _lpType, // 0: ERC20 or 1: ERC721, find something better!!
		uint256 _stakeLockedType, // 0: "stakeLocked(uint256,uint256)"
		uint256 _withdrawLockedType // 0: "withdrawLocked(bytes32)" 1: "withdrawLocked(uint256)" 2: "withdrawLocked(bytes32,address)"
	) public onlyGovernance {
		lpInfos[_lpToken] = LPInformations(_lpLocker, _rewards, _lpType, _stakeLockedType, _withdrawLockedType);
	}

	// TODO : Mirror ALL governance functions from the Liquid Locker

	/* ==== Deposit ==== */
	function deposit(
		address _lpToken,
		uint256 _liquidity,
		uint256 _sec
	) public {
		require(lpInfos[_lpToken].lpLocker != address(0), "LP token not valid!");

		// Transfer LP to Liquid Locker
		if (lpInfos[_lpToken].lpType == 0) {
			IERC20(_lpToken).transferFrom(msg.sender, LIQUIDLOCKER, _liquidity);
		}
		if (lpInfos[_lpToken].lpType == 1) {
			IERC721(_lpToken).transferFrom(msg.sender, LIQUIDLOCKER, _liquidity);
			// TODO : verify if the Liquid Locker can accept ERC721
		}

		// Set approval from Liquid Locker to Frax Staking
		bytes memory _approve = abi.encodeWithSignature("approve(address,uint256)", lpInfos[_lpToken].lpLocker, _liquidity);
		(bool _successApprove, ) = ILiquidLocker(LIQUIDLOCKER).execute(_lpToken, 0, _approve);
		require(_successApprove, "!call approval failed");

		// Interacte with stakeLocked function
		bytes memory _stakeLocked;
		if (lpInfos[_lpToken].stakeLockedType == 0) {
			_stakeLocked = abi.encodeWithSignature("stakeLocked(uint256,uint256)", _liquidity, _sec);
		}

		(bool _successStakeLocked, ) = ILiquidLocker(LIQUIDLOCKER).execute(lpInfos[_lpToken].lpLocker, 0, _stakeLocked);
		require(_successStakeLocked, "!call stakeLocked failed");

		// TODO : Find a way to get back the kekId or the deposit, then push it on the mapping kekIdUser
	}

	/* ==== Withdraw ==== */
	function withdraw(
		address _lpToken,
		bytes32 _kekid,
		uint256 _tokenId
	) public {
		// TODO : Require the kekId is owned by the msg.sender
		require(lpInfos[_lpToken].lpLocker != address(0), "LP token not valid!");

		// Interacte with withdrawLocked function
		bytes memory _withdrawLocked;
		if (lpInfos[_lpToken].withdrawLockedType == 0) {
			_withdrawLocked = abi.encodeWithSignature("withdrawLocked(bytes32)", _kekid);
		}
		if (lpInfos[_lpToken].withdrawLockedType == 1) {
			_withdrawLocked = abi.encodeWithSignature("withdrawLocked(uint256)", _tokenId);
		}
		if (lpInfos[_lpToken].withdrawLockedType == 2) {
			_withdrawLocked = abi.encodeWithSignature("withdrawLocked(bytes32,address)", _kekid, msg.sender);
		}
		(bool _successWithdraw, ) = ILiquidLocker(LIQUIDLOCKER).execute(lpInfos[_lpToken].lpLocker, 0, _withdrawLocked);
		require(_successWithdraw, "withdraw failed");

		// TODO : Withdraw the rewards token send by FRAX, using for loo and lpInfos[_lpToken].reward
	}

	/* NEEDED ON LIQUID LOCKER ?
	// ERC721 Receiver
	function onERC721Received(
		address,
		address,
		uint256,
		bytes memory
	) public virtual override returns (bytes4) {
		return this.onERC721Received.selector;
	}*/
}
