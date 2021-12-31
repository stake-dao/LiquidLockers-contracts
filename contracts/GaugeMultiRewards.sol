// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interfaces/IDepositor.sol";
import "./interfaces/IVeSDT.sol";

// Diff: https://diffnow.com/report/n6tjs
// Original: https://github.com/curvefi/multi-rewards/blob/master/contracts/MultiRewards.sol
contract GaugeMultiRewards is ReentrancyGuard, Pausable {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	/* ========== STATE VARIABLES ========== */

	struct Reward {
		address rewardsDistributor;
		uint256 rewardsDuration;
		uint256 periodFinish;
		uint256 rewardRate;
		uint256 lastUpdateTime;
		uint256 rewardPerTokenStored;
	}

	IERC20 public stakingToken;
	IERC20 public SDT;
	IERC20 public veSDT;

	mapping(address => Reward) public rewardData;

	address public governance;
	address[] public rewardTokens;
	address public claimContract;

	// user -> reward token -> amount
	mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;
	mapping(address => mapping(address => uint256)) public rewards;

	uint256 private _totalSupply;
	uint256 public derivedSupply;

	mapping(address => uint256) private _balances;
	mapping(address => uint256) public derivedBalances;

	/* ========== CONSTRUCTOR ========== */

	constructor(
		address _stakingToken,
		address _sdt,
		address _veSDT
	) public {
		governance = msg.sender;
		stakingToken = IERC20(_stakingToken);
		SDT = IERC20(_sdt);
		veSDT = IERC20(_veSDT);
	}

	/* ========== EVENTS ========== */

	event RewardAdded(uint256 reward);
	event Staked(address indexed user, uint256 amount);
	event Withdrawn(address indexed user, uint256 amount);
	event RewardPaid(address indexed user, address indexed rewardsToken, uint256 reward);
	event RewardsDurationUpdated(address token, uint256 newDuration);
	event Recovered(address token, uint256 amount);
	event RewardPaidToProxy(address indexed user, address indexed rewardsToken, uint256 reward);
	event ClaimContractSet(address indexed claimContract);
	event RewardTokenAdded(address indexed _rewardsToken, address indexed _rewardsDistributor, uint256 _rewardsDuration);
	event RewardDistributorSet(address indexed _rewardsToken,address indexed _rewardsDistributor);
	event GovernanceSet(address indexed _governance);
	/* ========== VIEWS ========== */

	function totalSupply() external view returns (uint256) {
		return _totalSupply;
	}

	function balanceOf(address account) external view returns (uint256) {
		return _balances[account];
	}

	function lastTimeRewardApplicable(address _rewardsToken) public view returns (uint256) {
		return Math.min(block.timestamp, rewardData[_rewardsToken].periodFinish);
	}

	function getRewardTokensLength() public view returns (uint256) {
		return rewardTokens.length;
	}

	function rewardPerToken(address _rewardsToken) public view returns (uint256) {
		if (_totalSupply == 0) {
			return rewardData[_rewardsToken].rewardPerTokenStored;
		}
		return
			rewardData[_rewardsToken].rewardPerTokenStored.add(
				lastTimeRewardApplicable(_rewardsToken)
					.sub(rewardData[_rewardsToken].lastUpdateTime)
					.mul(rewardData[_rewardsToken].rewardRate)
					.mul(1e18)
					.div(_totalSupply)
			);
	}

	function derivedBalance(address _account) public view returns (uint256) {
		uint256 balance = _balances[_account];
		uint256 derived = balance.mul(40).div(100);
		uint256 adjusted = (_totalSupply.mul(veSDT.balanceOf(_account)).div(veSDT.totalSupply())).mul(60).div(100);
		return Math.min(derived.add(adjusted), balance);
	}

	function earned(address _account, address _rewardsToken) public view returns (uint256) {
		uint256 userBalance = _rewardsToken == address(SDT) ? derivedBalances[_account] : _balances[_account];

		return
			userBalance.mul(rewardPerToken(_rewardsToken).sub(userRewardPerTokenPaid[_account][_rewardsToken])).div(1e18).add(
				rewards[_account][_rewardsToken]
			);
	}

	function getRewardForDuration(address _rewardsToken) external view returns (uint256) {
		return rewardData[_rewardsToken].rewardRate.mul(rewardData[_rewardsToken].rewardsDuration);
	}

	/* ========== MUTATIVE FUNCTIONS ========== */

	/// @notice Adds reward token and the distributor for the same
	/// @param _rewardsToken Address of the reward token
	/// @param _rewardsDistributor Address of the rewards distributor
	/// @param _rewardsDuration Duration of the rewards in seconds
	function addReward(
		address _rewardsToken,
		address _rewardsDistributor,
		uint256 _rewardsDuration
	) public onlyGovernance {
		require(rewardData[_rewardsToken].rewardsDuration == 0);
		rewardTokens.push(_rewardsToken);
		rewardData[_rewardsToken].rewardsDistributor = _rewardsDistributor;
		rewardData[_rewardsToken].rewardsDuration = _rewardsDuration;

		emit RewardTokenAdded(_rewardsToken, _rewardsDistributor, _rewardsDuration);
	}

	/// @notice Updates the derived balance of the address
	/// @dev Called after the user has claimed the rewards
	/// @param _account The address for which the derivedBalance needs to be updated
	function kick(address _account) public {
		uint256 _derivedBalance = derivedBalances[_account];
		derivedSupply = derivedSupply.sub(_derivedBalance);
		_derivedBalance = derivedBalance(_account);
		derivedBalances[_account] = _derivedBalance;
		derivedSupply = derivedSupply.add(_derivedBalance);
	}

	/// @notice Stake the supplied amount of staking token for the supplied address
	/// @param amount Amount of staking token to be staked
	/// @param account Address for which the amount is to be staked
	function _stake(uint256 amount, address account) internal whenNotPaused updateReward(account) {
		require(amount > 0, "Cannot stake 0");
		_totalSupply = _totalSupply.add(amount);
		_balances[account] = _balances[account].add(amount);
		stakingToken.safeTransferFrom(msg.sender, address(this), amount);
		
		emit Staked(account, amount);
	}

	/// @notice Withdraw the staked token for a address
	/// @param amount Amount of tokens to be unstaked
	/// @param account Address for which the amount is to be unstaked
	function _withdraw(uint256 amount, address account) internal nonReentrant updateReward(account) {
		require(amount > 0, "Cannot withdraw 0");
		_getRewardFor(account);
		_totalSupply = _totalSupply.sub(amount);
		_balances[account] = _balances[account].sub(amount);
		stakingToken.safeTransfer(msg.sender, amount);
		emit Withdrawn(account, amount);
	}

	/// @notice Stake the supplied amount of staking token for the user calling this
	/// @param amount the amount to be staked
	function stake(uint256 amount) external {
		_stake(amount, msg.sender);
	}

	/// @notice Stakes the token for the account supplied
	/// @param account Address for which the amount is to be staked
	/// @param amount Amount of staking token to be staked
	function stakeFor(address account, uint256 amount) external {
		_stake(amount, account);
	}

	/// @notice Withdraw the staked token for the address calling this
	/// @param amount Amount of tokens to be unstaked
	function withdraw(uint256 amount) external {
		_withdraw(amount, msg.sender);
	}

	/// @notice Withdraw the staked token for a address
	/// @param account Address for which the amount is to be unstaked
	/// @param amount Amount of tokens to be unstaked
	function withdrawFor(address account, uint256 amount) external {
		require(tx.origin == account, "withdrawFor: account != tx.origin");
		_withdraw(amount, account);
	}

	function _getRewardFor(address account) internal updateReward(account) {
		for (uint256 i; i < rewardTokens.length; i++) {
			address _rewardsToken = rewardTokens[i];
			uint256 reward = rewards[account][_rewardsToken];

			if (reward > 0) {
				rewards[account][_rewardsToken] = 0;
				IERC20(_rewardsToken).safeTransfer(account, reward);
				emit RewardPaid(account, _rewardsToken, reward);
			}
		}
	}

	/// @notice Lets the user claim rewards
	function getReward() public nonReentrant {
		_getRewardFor(msg.sender);
	}

	/// @notice Claim reward for a particular address
	/// @dev The claimed reward goes to the address for which it is being claimed
	/// @param account The address for which to claim reward for
	function getRewardFor(address account) public nonReentrant {
		_getRewardFor(account);
	}

	function _getRewardAndLockFor(
		address account,
		bool[] memory locked, // [true, true]
		address[] memory depositors // [veSDTaddr, fxsDepositor]
	) internal updateReward(account) {
		for (uint256 i; i < rewardTokens.length; i++) {
			address _rewardsToken = rewardTokens[i];
			uint256 reward = rewards[account][_rewardsToken];

			bool isLock = locked[i];

			if (reward > 0) {
				rewards[account][_rewardsToken] = 0;

				if (_rewardsToken == address(SDT) && isLock) {
					//TODO: This might not work since deposit_for will take the value from the for acccount
					IERC20(SDT).approve(depositors[i], reward);
					IVeSDT(depositors[i]).deposit_for_sd(msg.sender, reward);
					// IVeSDT(depositors[i]).deposit_for(msg.sender, reward);
				} else if (_rewardsToken != address(SDT) && isLock) {
					IERC20(_rewardsToken).approve(depositors[i], reward);
					IDepositor(depositors[i]).depositFor(account, reward);
				} else {
					IERC20(_rewardsToken).safeTransfer(account, reward);
					emit RewardPaid(account, _rewardsToken, reward);
				}
			}
		}
	}

	/// @notice Claim and lock the reward for the calling address
	/// @param locked Boolean values for each reward token indicating if they have to be locked or not
	/// @param depositors Depositors for each reward token
	function getRewardAndLock(bool[] memory locked, address[] memory depositors) public nonReentrant {
		_getRewardAndLockFor(msg.sender, locked, depositors);
	}

	/// @notice Claim and lock the reward for the supplied address
	/// @param account The address for which to claim & lock reward for
	/// @param locked Boolean values for each reward token indicating if they have to be locked or not
	/// @param depositors Depositors for each reward token
	function getRewardAndLockFor(
		address account,
		bool[] memory locked,
		address[] memory depositors
	) public nonReentrant {
		_getRewardAndLockFor(account, locked, depositors);
	}

	/* ========== RESTRICTED FUNCTIONS ========== */

	/// @notice Sets the reward distributor for a particular reward token
	/// @param _rewardsToken Address of the reward token
	/// @param _rewardsDistributor Address of the distributor for the reward token
	function setRewardsDistributor(address _rewardsToken, address _rewardsDistributor) external onlyGovernance {
		rewardData[_rewardsToken].rewardsDistributor = _rewardsDistributor;
		emit RewardDistributorSet(_rewardsToken, _rewardsDistributor);
	}

	function setGovernance(address _governance) public onlyGovernance {
		governance = _governance;
		emit GovernanceSet(_governance);
	}

	function notifyRewardAmount(address _rewardsToken, uint256 reward) external updateReward(address(0)) {
		require(rewardData[_rewardsToken].rewardsDistributor == msg.sender, "!rewardsDistributor");
		// handle the transfer of reward tokens via `transferFrom` to reduce the number
		// of transactions required and ensure correctness of the reward amount
		IERC20(_rewardsToken).safeTransferFrom(msg.sender, address(this), reward);

		if (block.timestamp >= rewardData[_rewardsToken].periodFinish) {
			rewardData[_rewardsToken].rewardRate = reward.div(rewardData[_rewardsToken].rewardsDuration);
		} else {
			uint256 remaining = rewardData[_rewardsToken].periodFinish.sub(block.timestamp);
			uint256 leftover = remaining.mul(rewardData[_rewardsToken].rewardRate);
			rewardData[_rewardsToken].rewardRate = reward.add(leftover).div(rewardData[_rewardsToken].rewardsDuration);
		}

		rewardData[_rewardsToken].lastUpdateTime = block.timestamp;
		rewardData[_rewardsToken].periodFinish = block.timestamp.add(rewardData[_rewardsToken].rewardsDuration);
		emit RewardAdded(reward);
	}

	/// @notice Recover any ERC20 token other than the staking token
	/// @param tokenAddress The address of the token to be recovered
	/// @param tokenAmount The amount of token to be recovered
	/// @param destination The destination address for the recovered token
	function recoverERC20(
		address tokenAddress,
		uint256 tokenAmount,
		address destination
	) external onlyGovernance {
		require(tokenAddress != address(stakingToken), "Cannot withdraw staking token");
		require(rewardData[tokenAddress].lastUpdateTime == 0, "Cannot withdraw reward token");
		IERC20(tokenAddress).safeTransfer(destination, tokenAmount);
		emit Recovered(tokenAddress, tokenAmount);
	}

	function setRewardsDuration(address _rewardsToken, uint256 _rewardsDuration) external {
		require(block.timestamp > rewardData[_rewardsToken].periodFinish, "Reward period still active");
		require(rewardData[_rewardsToken].rewardsDistributor == msg.sender);
		require(_rewardsDuration > 0, "Reward duration must be non-zero");
		rewardData[_rewardsToken].rewardsDuration = _rewardsDuration;
		emit RewardsDurationUpdated(_rewardsToken, rewardData[_rewardsToken].rewardsDuration);
	}

	function setClaimContract(address _claimContract) public onlyGovernance {
		claimContract = _claimContract;
		emit ClaimContractSet(_claimContract);
	}

	/// @notice Claim Reward and lock the choosen token
	/// @dev This function was created to be used by claim contract only to help the user provide a one click solution for claiming rewards & locking them
	/// After claiming the rewards the token which are to be locked gets sent to the claim contract and the one which are not to be locked gets sent to the account
	//Note: Assumption is made that the locks would be received in the right order
	/// @param account The address for which to claim reward for
	/// @param locked Boolean values for each reward token indicating if they have to be locked or not
	function claimReward(address account, bool[] memory locked) public updateReward(account) {
		require(msg.sender == claimContract, "!claimContract");

		for (uint256 i; i < rewardTokens.length; i++) {
			address _rewardsToken = rewardTokens[i];
			uint256 reward = rewards[account][_rewardsToken];

			bool isLock = locked[i];
			if (reward > 0) {
				rewards[account][_rewardsToken] = 0;
				if (isLock) {
					IERC20(_rewardsToken).safeTransfer(msg.sender, reward);
				} else {
					IERC20(_rewardsToken).safeTransfer(account, reward);
					emit RewardPaid(account, _rewardsToken, reward);
				}
			}
		}
	}

	/// @notice Claim Reward and send to depositor proxy
	/// @dev This function was created to be used by depositor proxy to let the users easily zap out their rewards
	/// @param account The address for which to claim reward for
	/// @param depositorProxy The address of the depositor proxy
	function claimReward(address account, address depositorProxy) public updateReward(account) {
		require(msg.sender == claimContract, "!claimContract");

		for (uint256 i; i < rewardTokens.length; i++) {
			address _rewardsToken = rewardTokens[i];
			uint256 reward = rewards[account][_rewardsToken];
			if (reward > 0) {
				rewards[account][_rewardsToken] = 0;
				IERC20(_rewardsToken).safeTransfer(depositorProxy, reward);
				emit RewardPaidToProxy(account, _rewardsToken, reward);
			}
		}
	}

	/* ========== MODIFIERS ========== */

	modifier updateReward(address account) {
		for (uint256 i; i < rewardTokens.length; i++) {
			address token = rewardTokens[i];
			rewardData[token].rewardPerTokenStored = rewardPerToken(token);
			rewardData[token].lastUpdateTime = lastTimeRewardApplicable(token);
			if (account != address(0)) {
				rewards[account][token] = earned(account, token);
				userRewardPerTokenPaid[account][token] = rewardData[token].rewardPerTokenStored;
			}
		}
		_;
		if (account != address(0)) {
			kick(account);
		}
	}

	modifier onlyGovernance() {
		require(msg.sender == governance, "!gov");
		_;
	}
}
