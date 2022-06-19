// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ILocker.sol";
import "../interfaces/IProxyVault.sol";
import "../interfaces/IPoolRegistry.sol";

contract Booster {
	using SafeERC20 for IERC20;

	address public constant FXS = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);

	address public immutable proxy;
	address public immutable poolRegistry;
	address public owner;
	address public pendingOwner;
	address public poolManager;

	constructor(address _proxy, address _poolReg) {
		proxy = _proxy;
		poolRegistry = _poolReg;
		owner = msg.sender;
		poolManager = msg.sender;
	}

	modifier onlyOwner() {
		require(owner == msg.sender, "!auth");
		_;
	}

	modifier onlyPoolManager() {
		require(poolManager == msg.sender, "!auth");
		_;
	}

	// ########################### Public function ######################### //
	// #=#=#=#=#=#=#=#=#=#=# Personal Vault Section  #=#=#=#=#=#=#=#=#=#=#=# //

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

		//set vault veFXS proxy
		data = abi.encodeWithSelector(bytes4(keccak256("setVeFXSProxy(address)")), proxy);
		(success, ) = ILocker(proxy).execute(vault, uint256(0), data);
		require(success, "Failed set Proxy");
	}

	// #=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=# //

	// ######################## Restricted function ######################## //
	// #=#=#=#=#=#=#=#=#=#  Booster Management Section #=#=#=#=#=#=#=#=#=#=# //

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

	//recover tokens on this contract
	function recoverERC20(
		address _tokenAddress,
		uint256 _tokenAmount,
		address _withdrawTo
	) external onlyOwner {
		IERC20(_tokenAddress).safeTransfer(_withdrawTo, _tokenAmount);
		emit Recovered(_tokenAddress, _tokenAmount);
	}

	// #=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=# //

	// #=#=#=#=#=#=#=# Start Pool Registry Management Section #=#=#=#=#=#=#=# //

	/* ---- Setter ---- */
	function setOperator(address _op) external onlyPoolManager {
		IPoolRegistry(poolRegistry).setOperator(_op);
	}

	function setDistributor(address _distributor) external onlyPoolManager {
		IPoolRegistry(poolRegistry).setDistributor(_distributor);
	}

	//set a new reward pool implementation for future pools
	function setPoolRewardImplementation(address _impl) external onlyPoolManager {
		IPoolRegistry(poolRegistry).setRewardImplementation(_impl);
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

	// #=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=# //

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

	function setFxsDepositor(address _FXSDepositor) external onlyOwner {
		ILocker(proxy).setFxsDepositor(_FXSDepositor);
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
		(bool _success, bytes memory _data) = ILocker(proxy).execute(to, value, data);
		return (_success, _data);
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

	// #=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=#=# //

	// #=#=#=#=#=#=#=#=#=#=#=#=#=#=#    EVENTS   #=#=#=#=#=#=#=#=#=#=#=#=#=# //
	event SetPendingOwner(address indexed _address);
	event OwnerChanged(address indexed _address);
	event PoolManagerChanged(address indexed _address);
	event Recovered(address indexed _token, uint256 _amount);
}
