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

interface ILPLocker {
	struct LockedStake {
		bytes32 kek_id;
		uint256 start_timestamp;
		uint256 liquidity;
		uint256 ending_timestamp;
		uint256 lock_multiplier; // 6 decimals of precision. 1x = 1000000
	}

	function lockedStakesOf(address) external view returns (LockedStake[] memory);
}

contract StrategyProxyFRAX {
	address public governance;
	address public constant LIQUIDLOCKER = 0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f;

	mapping(address => LPInformations) public lpInfos;
	mapping(address => bytes32[]) public kekIdUser; // TODO : find a way to make it transferable (i.e. minting token)

	struct LPInformations {
		address lpLocker;
		address[] rewards;
		uint256 lpType; // 0: ERC20 or 1: ERC721, find something better!!
		uint256 stakeLockedType; // 0: "stakeLocked(uint256,uint256)"
		uint256 withdrawLockedType; // 0: "withdrawLocked(bytes32)" 1: "withdrawLocked(uint256)" 2: "withdrawLocked(bytes32,address)"
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

	/* ==== Views ==== */
	function isKekIdOwner(address _address, bytes32 _kek_id) public view returns (bool) {
		bool isOwner = false;
		for (uint256 i; i < kekIdUser[_address].length; i++) {
			if (kekIdUser[_address][i] == _kek_id) {
				isOwner = true;
			}
		}
		return (isOwner);
	}

	function getLPInfos(address _lpToken) public view returns (LPInformations memory) {
		return (lpInfos[_lpToken]);
	}

	function getKekID(address _address) public view returns (bytes32[] memory) {
		return (kekIdUser[_address]);
	}

	/* ==== Only Governance ==== */
	function setLPInfos(
		address _lpToken,
		address _lpLocker,
		address[] memory _rewards,
		uint256 _lpType,
		uint256 _stakeLockedType,
		uint256 _withdrawLockedType
	) public onlyGovernance {
		require(lpInfos[_lpToken].lpLocker == address(0), "!already exist");
		lpInfos[_lpToken] = LPInformations(_lpLocker, _rewards, _lpType, _stakeLockedType, _withdrawLockedType);
	}

	// TODO : LPInformation updater for an already existing LP Token

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

		// To be implemented later
		/*
		if (lpInfos[_lpToken].lpType == 1) {
			IERC721(_lpToken).transferFrom(msg.sender, LIQUIDLOCKER, _liquidity);
			// TODO : verify if the Liquid Locker can accept ERC721
		}*/

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

		uint256 _length = ILPLocker(lpInfos[_lpToken].lpLocker).lockedStakesOf(LIQUIDLOCKER).length;
		bytes32 _kek_id = ILPLocker(lpInfos[_lpToken].lpLocker).lockedStakesOf(LIQUIDLOCKER)[_length - 1].kek_id;
		kekIdUser[msg.sender].push(_kek_id);
	}

	/* ==== Withdraw ==== */
	function withdraw(
		address _lpToken,
		bytes32 _kekid,
		uint256 _tokenId
	) public {
		require(lpInfos[_lpToken].lpLocker != address(0), "LP token not valid!");
		require(isKekIdOwner(msg.sender, _kekid) == true, "Not owner of this kekId");

		// Encode with Signature withdraw function
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

		// Call Withdraw function
		uint256 _balanceBefore = IERC20(_lpToken).balanceOf(LIQUIDLOCKER);
		(bool _successWithdraw, ) = ILiquidLocker(LIQUIDLOCKER).execute(lpInfos[_lpToken].lpLocker, 0, _withdrawLocked);
		require(_successWithdraw, "withdraw failed");
		uint256 _bal = IERC20(_lpToken).balanceOf(LIQUIDLOCKER) - _balanceBefore;

		// Send LP back to the user
		bytes memory _sendLPToken = abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _bal);
		(bool _successTransfer, ) = ILiquidLocker(LIQUIDLOCKER).execute(_lpToken, 0, _sendLPToken);
		require(_successTransfer, "Transfer LP failed");

		// Send reward token to the user
		_sendRewards(_lpToken);
	}

	function _sendRewards(address _lpToken) private {
		for (uint256 i = 0; i < lpInfos[_lpToken].rewards.length; i++) {
			uint256 _reward = IERC20(lpInfos[_lpToken].rewards[i]).balanceOf(LIQUIDLOCKER);
			if (_reward > 0) {
				//console.log("rewards: ", _reward);
				bytes memory _sendReward = abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _reward);
				(bool _successSendReward, ) = ILiquidLocker(LIQUIDLOCKER).execute(lpInfos[_lpToken].rewards[i], 0, _sendReward);
				require(_successSendReward, "Send reward failed"); // TODO : deal with fees
			}
		}
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
