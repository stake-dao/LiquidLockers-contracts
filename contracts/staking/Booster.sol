// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ILocker.sol";

interface IProxyVault {
	enum VaultType {
		Erc20Baic,
		UniV3,
		Convex
	}

	function initialize(
		address _owner,
		address _stakingAddress,
		address _stakingToken,
		address _rewardsAddress
	) external;

	function changeRewards(address _rewardsAddress) external;

	function usingProxy() external returns (address);

	function rewards() external returns (address);

	function getReward() external;

	function getReward(bool _claim) external;

	function getReward(bool _claim, address[] calldata _rewardTokenList) external;

	function earned() external view returns (address[] memory token_addresses, uint256[] memory total_earned);
}

interface IPoolRegistry {
	function poolLength() external view returns (uint256);

	function poolInfo(uint256 _pid)
		external
		view
		returns (
			address,
			address,
			address,
			uint8
		);

	function vaultMap(uint256 _pid, address _user) external view returns (address vault);

	function addUserVault(uint256 _pid, address _user)
		external
		returns (
			address vault,
			address stakeAddress,
			address stakeToken,
			address rewards
		);

	function deactivatePool(uint256 _pid) external;

	function createNewPoolRewards(uint256 _pid) external;

	function addPool(
		address _implementation,
		address _stakingAddress,
		address _stakingToken
	) external;

	function setRewardActiveOnCreation(bool _active) external;

	function setRewardImplementation(address _imp) external;

	function setDistributor(address _distributor) external;

	function setOperator(address _op) external;
}

/*
Main interface for the whitelisted proxy contract.
*/
contract Booster {
	using SafeERC20 for IERC20;

	address public constant fxs = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);

	address public immutable proxy;
	address public immutable poolRegistry;
	address public owner;
	address public pendingOwner;
	address public poolManager;
	//address public rewardManager;
	//address public feeclaimer;
	//address public feeQueue;
	//address public immutable feeRegistry;
	bool public isShutdown;

	//mapping(address => mapping(address => bool)) public feeClaimMap;

	constructor(
		address _proxy,
		address _poolReg
		//address _feeReg
	) {
		proxy = _proxy;
		poolRegistry = _poolReg;
		isShutdown = false;
		owner = msg.sender;
		poolManager = msg.sender;
		//feeclaimer = msg.sender;
		//feeRegistry = _feeReg;
		//rewardManager = msg.sender;
		//feeClaimMap[address(0xc6764e58b36e26b08Fd1d2AeD4538c02171fA872)][fxs] = true;
		//emit FeeClaimPairSet(address(0xc6764e58b36e26b08Fd1d2AeD4538c02171fA872), fxs, true);
	}

	modifier onlyOwner() {
		require(owner == msg.sender, "!auth");
		_;
	}

	modifier onlyPoolManager() {
		require(poolManager == msg.sender, "!auth");
		_;
	}

	//set pending owner
	function setPendingOwner(address _po) external onlyOwner {
		pendingOwner = _po;
		emit SetPendingOwner(_po);
	}

	//claim ownership
	function acceptPendingOwner() external {
		require(pendingOwner != address(0) && msg.sender == pendingOwner, "!p_owner");

		owner = pendingOwner;
		pendingOwner = address(0);
		emit OwnerChanged(owner);
	}

	//set pool manager
	function setPoolManager(address _pmanager) external onlyOwner {
		poolManager = _pmanager;
		emit PoolManagerChanged(_pmanager);
	}

	//shutdown this contract.
	function shutdownSystem() external onlyOwner {
		//This version of booster does not require any special steps before shutting down
		//and can just immediately be set.
		isShutdown = true;
		emit Shutdown();
	}

	//recover tokens on this contract
	function recoverERC20(
		address _tokenAddress,
		uint256 _tokenAmount,
		address _withdrawTo
	) external onlyOwner {
		IERC20(_tokenAddress).safeTransfer(_withdrawTo, _tokenAmount);
		emit Recovered(_tokenAddress, _tokenAmount);
	}
	

	// #=#=#=#=#=#=#=# Start Liquid Locker Management Section #=#=#=#=#=#=#=# */
	function createLock(uint256 _value, uint256 _unlockTime) external onlyOwner {
		ILocker(proxy).createLock(_value, _unlockTime);
	}

	function increaseAmount(uint256 _value) external onlyOwner {
		ILocker(proxy).increaseAmount(_value);
	}

	function increaseUnlockTime(uint256 _unlockTime) external onlyOwner {
		ILocker(proxy).increaseUnlockTime(_unlockTime);
	}

	function claimFXSRewards(address _recipient) external onlyOwner {
		ILocker(proxy).claimFXSRewards(_recipient);
	}

	function release(address _recipient) external onlyOwner {
		ILocker(proxy).release(_recipient);
	}

	function voteGaugeWeight(address _gauge, uint256 _weight) external onlyOwner {
		ILocker(proxy).voteGaugeWeight(_gauge, _weight);
	}

	function setGovernance(address _governance) external onlyOwner {
		ILocker(proxy).setGovernance(_governance);
	}

	function setFxsDepositor(address _fxsDepositor) external onlyOwner {
		ILocker(proxy).setFxsDepositor(_fxsDepositor);
	}

	function setYieldDistributor(address _newYD) external onlyOwner {
		ILocker(proxy).setYieldDistributor(_newYD);
	}

	function setGaugeController(address _gaugeController) external onlyOwner {
		ILocker(proxy).setGaugeController(_gaugeController);
	}

	function setAccumulator(address _accumulator) external onlyOwner {
		ILocker(proxy).setAccumulator(_accumulator);
	}

	function execute(
		address to,
		uint256 value,
		bytes calldata data
	) external onlyOwner returns (bool, bytes memory) {
		ILocker(proxy).execute(to, value, data);
	}

	function recoverERC20FromProxy(
		address _tokenAddress,
		uint256 _tokenAmount,
		address _withdrawTo
	) external onlyOwner {
		bytes memory data = abi.encodeWithSelector(
			bytes4(keccak256("transfer(address,uint256)")),
			_withdrawTo,
			_tokenAmount
		);
		ILocker(proxy).execute(_tokenAddress, uint256(0), data);

		emit Recovered(_tokenAddress, _tokenAmount);
	}

	// #=#=#=#=#=#=#=# End of Liquid Locker Management Section #=#=#=#=#=#=#=# //






	// #=#=#=#=#=#=#=# Start Pool Registry Management Section #=#=#=#=#=#=#=# //

	/* ---- Setter ---- */
	function setOperator(address _op) external onlyPoolManager{
		IPoolRegistry(poolRegistry).setOperator(_op);
	}

	function setDistributor(address _distributor) external onlyPoolManager {
		IPoolRegistry(poolRegistry).setDistributor(_distributor);
	}
	
	//set a new reward pool implementation for future pools
	function setPoolRewardImplementation(address _impl) external onlyPoolManager {
		IPoolRegistry(poolRegistry).setRewardImplementation(_impl);
	}

	//set extra reward contracts to be active when pools are created
	function setRewardActiveOnCreation(bool _active) external onlyPoolManager {
		IPoolRegistry(poolRegistry).setRewardActiveOnCreation(_active);
	}

	/* ---- Pool management ---- */
	//add pool on registry
	function addPool(
		address _implementation,
		address _stakingAddress,
		address _stakingToken
	) external onlyPoolManager {
		IPoolRegistry(poolRegistry).addPool(_implementation, _stakingAddress, _stakingToken);
	}

	//replace rewards contract on a specific pool
	function createNewPoolRewards(uint256 _pid) external onlyPoolManager {
		IPoolRegistry(poolRegistry).createNewPoolRewards(_pid);
	}

	//deactivate a pool
	function deactivatePool(uint256 _pid) external onlyPoolManager {
		IPoolRegistry(poolRegistry).deactivatePool(_pid);
	}

	/* ---- Vault management ---- */
	//create a vault for a user
	function createVault(uint256 _pid) external {
		//create minimal proxy vault for specified pool
		(address vault, address stakeAddress, address stakeToken, address rewards) = IPoolRegistry(poolRegistry)
			.addUserVault(_pid, msg.sender);
		//make voterProxy call proxyToggleStaker(vault) on the pool's stakingAddress to set it as a proxied child
		bytes memory data = abi.encodeWithSelector(bytes4(keccak256("proxyToggleStaker(address)")), vault);
		(bool success, ) = ILocker(proxy).execute(stakeAddress, uint256(0), data);
		require(success, "Failed proxy toggle");

		//call proxy initialize
		IProxyVault(vault).initialize(msg.sender, stakeAddress, stakeToken, rewards);

		//set vault vefxs proxy
		data = abi.encodeWithSelector(bytes4(keccak256("setVeFXSProxy(address)")), proxy);
		(success, ) = ILocker(proxy).execute(vault, uint256(0), data);
		require(success, "Failed set Proxy");
	}

	// #=#=#=#=#=#=#=# End of Pool Registry Management Section #=#=#=#=#=#=#=# //

/*
	// #=#=#=#=#=#=#=# Start Deprecated Section #=#=#=#=#=#=#=# //
	// This will surely be removed, because StakeDAO handles fees differently
	//vote for gauge weights
	/*
    function voteGaugeWeight(address _controller, address _gauge, uint256 _weight) external onlyOwner{
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("voteGaugeWeight(address,uint256)")), _gauge, _weight);
        IStaker(proxy).execute(_controller,uint256(0),data);
    }
    */
	//set voting delegate
	/*
    function setDelegate(address _delegateContract, address _delegate, bytes32 _space) external onlyOwner{
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("setDelegate(bytes32,address)")), _space, _delegate);
        IStaker(proxy).execute(_delegateContract,uint256(0),data);
        emit DelegateSet(_delegate);
    }
    */
	/*
    //claim fees - if set, move to a fee queue that rewards can pull from
    function claimFees(address _distroContract, address _token) external {
        require(feeclaimer == address(0) || feeclaimer == msg.sender, "!auth");
        require(feeClaimMap[_distroContract][_token],"!claimPair");

        uint256 bal;
        if(feeQueue != address(0)){
            bal = IStaker(proxy).claimFees(_distroContract, _token, feeQueue);
        }else{
            bal = IStaker(proxy).claimFees(_distroContract, _token, address(this));
        }
        emit FeesClaimed(bal);
    }

    //call vefxs checkpoint
    function checkpointFeeRewards(address _distroContract) external {
        require(feeclaimer == address(0) || feeclaimer == msg.sender, "!auth");

        IStaker(proxy).checkpointFeeRewards(_distroContract);
    }
    */

	//set fees on user vaults
	// Not needed anymore because the deployer of the feeRegistry Contract 
	// Will have all the power for modifing fees
	// For Convex, this is the FXS Locker who has all the power
	/*
	function setPoolFees(
		uint256 _cvxfxs,
		uint256 _cvx,
		uint256 _platform
	) external onlyOwner {
		require(!isShutdown, "shutdown");

		bytes memory data = abi.encodeWithSelector(
			bytes4(keccak256("setFees(uint256,uint256,uint256)")),
			_cvxfxs,
			_cvx,
			_platform
		);
		ILocker(proxy).execute(feeRegistry, uint256(0), data);
	}

	//set fee deposit address for all user vaults
	function setPoolFeeDeposit(address _deposit) external onlyOwner {
		require(!isShutdown, "shutdown");

		bytes memory data = abi.encodeWithSelector(bytes4(keccak256("setDepositAddress(address)")), _deposit);
		ILocker(proxy).execute(feeRegistry, uint256(0), data);
	}
	*/

	//set fee queue, a contract fees are moved to when claiming
	/*
	function setFeeQueue(address _queue) external onlyOwner {
		feeQueue = _queue;
		emit FeeQueueChanged(_queue);
	}

	//set who can call claim fees, 0x0 address will allow anyone to call
	function setFeeClaimer(address _claimer) external onlyOwner {
		feeclaimer = _claimer;
		emit FeeClaimerChanged(_claimer);
	}

	function setFeeClaimPair(
		address _claimAddress,
		address _token,
		bool _active
	) external onlyOwner {
		feeClaimMap[_claimAddress][_token] = _active;
		emit FeeClaimPairSet(_claimAddress, _token, _active);
	}
	//set a reward manager address that controls extra reward contracts for each pool
	function setRewardManager(address _rmanager) external onlyOwner {
		rewardManager = _rmanager;
		emit RewardManagerChanged(_rmanager);
	}
	*/

	// Not needed anymore
	/*
	function changeRewards(address _implementation, address _rewardsAddress) external onlyOwner{
		bytes memory data = abi.encodeWithSelector(bytes4(keccak256("changeRewards(address)")), _rewardsAddress);
		(bool success, ) = ILocker(proxy).execute(_implementation, uint256(0), data);
		require(success,"changeRewards_failed");
	}
	*/
	// #=#=#=#=#=#=#=# End of Deprecated Section #=#=#=#=#=#=#=# //



	/* #=#=#=#=#=#=#=#== EVENTS #=#=#=#=#=#=#=#== */
	event SetPendingOwner(address indexed _address);
	event OwnerChanged(address indexed _address);
	event FeeQueueChanged(address indexed _address);
	event FeeClaimerChanged(address indexed _address);
	event FeeClaimPairSet(address indexed _address, address indexed _token, bool _value);
	event RewardManagerChanged(address indexed _address);
	event PoolManagerChanged(address indexed _address);
	event Shutdown();
	event DelegateSet(address indexed _address);
	event FeesClaimed(uint256 _amount);
	event Recovered(address indexed _token, uint256 _amount);
}
