// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/ILiquidityGaugeStratFrax.sol";

interface IProxyFactory {
	function clone(address) external returns (address);
}

contract PoolRegistry {
	address public owner;
	address public constant PROXY_FACTORY = address(0x66807B5598A848602734B82E432dD88DBE13fC8f); // Need to be change with Stake DAO deployed proxy
	address public constant SDT = address(0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F);
	address public constant VE_SDT = address(0x0C30476f66034E11782938DF8e4384970B6c9e8a);
	address public constant VEBOOST = address(0xD67bdBefF01Fc492f1864E61756E5FBB3f173506);

	address public operator;
	address public rewardImplementation; // Liquidity Gauge Contract model
	address public distributor;
	PoolInfo[] public poolInfo;
	mapping(uint256 => mapping(address => address)) public vaultMap; //pool -> user -> vault
	mapping(uint256 => address[]) public poolVaultList; //pool -> vault array

	struct PoolInfo {
		address implementation; // Personal Vault model
		address stakingAddress; // Frax Gauge for stacking LP token
		address stakingToken; // LP token
		address rewardsAddress; // Liquidity Gauge V4 from Stake DAO for extra rewards
		uint8 active;
	}

	event PoolCreated(
		uint256 indexed poolid,
		address indexed implementation,
		address stakingAddress,
		address stakingToken
	);

	event PoolDeactivated(uint256 indexed poolid);
	event AddUserVault(address indexed user, uint256 indexed poolid);
	event OperatorChanged(address indexed account);
	event RewardImplementationChanged(address indexed implementation);
	event RewardActiveOnCreationChanged(bool value);

	constructor() {
		owner = msg.sender;
	}

	modifier onlyOwner() {
		require(owner == msg.sender, "!auth");
		_;
	}

	modifier onlyOperator() {
		require(operator == msg.sender, "!op auth");
		_;
	}

	//set operator/manager
	function setOperator(address _op) external onlyOwner {
		operator = _op;
		emit OperatorChanged(_op);
	}

	function setDistributor(address _distributor) external onlyOperator {
		distributor = _distributor;
	}

	//set extra reward implementation contract for future pools
	function setRewardImplementation(address _imp) external onlyOperator {
		rewardImplementation = _imp;
		emit RewardImplementationChanged(_imp);
	}

	//get number of pools
	function poolLength() external view returns (uint256) {
		return poolInfo.length;
	}

	//get number of vaults made for a specific pool
	function poolVaultLength(uint256 _pid) external view returns (uint256) {
		return poolVaultList[_pid].length;
	}

	//add a new pool and implementation
	/**
	 * @param _implementation is address of personal vault contract model
	 * @param _stakingAddress is address of Frax gauge for stacking LP token
	 * @param _stakingToken	is LP token for Frax gauge
	 */
	function addPool(
		address _implementation,
		address _stakingAddress,
		address _stakingToken
	) external onlyOperator {
		require(_implementation != address(0), "!imp");
		require(_stakingAddress != address(0), "!stkAdd");
		require(_stakingToken != address(0), "!stkTok");

		address rewards;
		if (rewardImplementation != address(0)) {
			rewards = IProxyFactory(PROXY_FACTORY).clone(rewardImplementation);
			ILiquidityGaugeStratFrax(rewards).initialize(
				owner,
				SDT,
				VE_SDT,
				VEBOOST,
				distributor,
				poolInfo.length,
				address(this)
			);
		}

		poolInfo.push(
			PoolInfo({
				implementation: _implementation,
				stakingAddress: _stakingAddress,
				stakingToken: _stakingToken,
				rewardsAddress: rewards,
				active: 1
			})
		);
		emit PoolCreated(poolInfo.length - 1, _implementation, _stakingAddress, _stakingToken);
	}

	//replace rewards contract on a specific pool.
	//each user must call changeRewards on vault to update to new contract
	function createNewPoolRewards(uint256 _pid) external onlyOperator {
		require(rewardImplementation != address(0), "!imp");

		//spawn new clone
		address rewards = IProxyFactory(PROXY_FACTORY).clone(rewardImplementation);
		ILiquidityGaugeStratFrax(rewards).initialize(owner, SDT, VE_SDT, VEBOOST, distributor, _pid, address(this));

		//change address
		poolInfo[_pid].rewardsAddress = rewards;
	}

	//deactivates pool so that new vaults can not be made.
	//can not force shutdown/withdraw user funds
	function deactivatePool(uint256 _pid) external onlyOperator {
		poolInfo[_pid].active = 0;
		emit PoolDeactivated(_pid);
	}

	//clone a new user vault
	function addUserVault(uint256 _pid, address _user)
		external
		onlyOperator
		returns (
			address vault,
			address stakingAddress,
			address stakingToken,
			address rewards
		)
	{
		require(vaultMap[_pid][_user] == address(0), "already exists");

		PoolInfo storage pool = poolInfo[_pid];
		require(pool.active > 0, "!active");

		//create
		vault = IProxyFactory(PROXY_FACTORY).clone(pool.implementation);
		//add to user map
		vaultMap[_pid][_user] = vault;
		//add to pool vault list
		poolVaultList[_pid].push(vault);

		//return values
		stakingAddress = pool.stakingAddress;
		stakingToken = pool.stakingToken;
		rewards = pool.rewardsAddress;

		emit AddUserVault(_user, _pid);
	}
}
