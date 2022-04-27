// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";
import "../accumulator/FxsAccumulator.sol";
import "../interfaces/ILiquidityGaugeFRAX.sol";
import "../interfaces/IMultiRewards.sol";

contract FraxStrategy is BaseStrategy {
	using SafeERC20 for IERC20;
	FxsAccumulator public accumulator;
	bytes public result;
	struct ClaimerReward {
		address rewardToken;
		uint256 amount;
	}
	enum MANAGEFEE {
		PERFFEE,
		VESDTFEE,
		ACCUMULATORFEE,
		CLAIMERREWARD
	}

	/* ========== CONSTRUCTOR ========== */
	constructor(
		ILocker _locker,
		address _governance,
		address _receiver,
		FxsAccumulator _accumulator
	) BaseStrategy(_locker, _governance, _receiver) {
		veSDTFee = 500; // %5
		accumulatorFee = 800; // %8
		claimerReward = 50; //%0.5
		accumulator = _accumulator;
	}

	function deposit(
		address _token,
		uint256 _amount,
		uint256 _sec
	) public onlyApprovedVault returns (bytes32) {
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		IERC20(_token).transferFrom(msg.sender, address(this), _amount);
		IERC20(_token).approve(address(locker), _amount);

		locker.execute(
			_token,
			0,
			abi.encodeWithSignature("transferFrom(address,address,uint256)", address(this), address(locker), _amount)
		);
		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", gauge, 0));
		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", gauge, _amount));
		uint256 _lockedLiquidity = ILiquidityGaugeFRAX(gauge).lockedLiquidityOf(address(locker));
		(bool success, ) = locker.execute(gauge, 0, abi.encodeWithSignature("stakeLocked(uint256,uint256)", _amount, _sec));
		require(success, "Deposit failed!");

		// Fetching the kekid directly form the calling of the stakeLocked function
		// with result from execute seems not working. Can be proposed : two Solutions :
		// 1.
		uint256 _lockedStakeLength = ILiquidityGaugeFRAX(gauge).lockedStakesOfLength(address(locker));
		bytes32 _kekId = ILiquidityGaugeFRAX(gauge).lockedStakesOf(address(locker))[_lockedStakeLength - 1].kek_id;
		// 2.
		bytes32 _kekIdCalculated = keccak256(abi.encodePacked(address(locker), block.timestamp, _amount, _lockedLiquidity));
		// Idea : second seems better

		require(_kekId == _kekIdCalculated);
		emit Deposited(gauge, _token, _amount);
		return (_kekId);
	}

	function claim(address _token) external override {
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		(bool success, ) = locker.execute(gauge, 0, abi.encodeWithSignature("getReward(address)", address(this)));
		require(success, "getReward failed");
		uint256 rewardLength = ILiquidityGaugeFRAX(gauge).getAllRewardTokens().length;
		for (uint256 i = 0; i < rewardLength; i++) {
			address rewardToken = ILiquidityGaugeFRAX(gauge).getAllRewardTokens()[i];
			if (rewardToken == address(0)) {
				break;
			}
			uint256 rewardsBalance = IERC20(rewardToken).balanceOf(address(this));
			if (rewardsBalance == 0) {
				continue;
			}
			uint256 multisigFee = (rewardsBalance * perfFee[gauge]) / BASE_FEE;
			uint256 accumulatorPart = (rewardsBalance * accumulatorFee) / BASE_FEE;
			uint256 veSDTPart = (rewardsBalance * veSDTFee) / BASE_FEE;
			uint256 claimerPart = (rewardsBalance * claimerReward) / BASE_FEE;
			IERC20(rewardToken).approve(address(accumulator), accumulatorPart);
			accumulator.depositToken(rewardToken, accumulatorPart);
			IERC20(rewardToken).transfer(rewardsReceiver, multisigFee);
			// To be setup after
			//IERC20(rewardToken).transfer(veSDTFeeProxy, veSDTPart);
			IERC20(rewardToken).transfer(msg.sender, claimerPart);
			uint256 netRewards = rewardsBalance - multisigFee - accumulatorPart - veSDTPart - claimerPart;
			IERC20(rewardToken).approve(multiGauges[gauge], netRewards);
			// To be setup after
			//IMultiRewards(multiGauges[gauge]).notifyRewardAmount(rewardToken, netRewards); // To be setup after
			emit Claimed(gauge, rewardToken, rewardsBalance);
		}
	}

	/*
	Global path of the LP token : 
	frax gauge => frax locker => frax vault => user
	Optimised path of the LP token : 
	frax gauge => frax vault => user // better

	But withdrawLocked with a specified address is not permitted for every frax gauge
	So do we want to have a global path logic, who is the same for every frax gauge 
	or do we want to optimise path when possible with a specified withdraw address? 

	Or maybe we will have to create different withdraw function, depending 
	on the withdrawLocked function signature?

	What about calling claim function during the withdraw? Answer : No 

	*/
	function withdraw(
		address _token,
		bytes32 _kekid,
		string memory _encode
	)
		public
		//bytes memory _signature
		onlyApprovedVault
	{
		//using require instead of modifier for saving gas
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		uint256 _before = IERC20(_token).balanceOf(address(locker));
		//string memory _decode = abi.decode(_encode, (string));
		(bool success, ) = locker.execute(
			gauge,
			0,
			//_signature
			abi.encodeWithSignature(_encode, _kekid, address(locker), 123456) // remark on the passes address
		);
		require(success, "Withdraw failed here!");
		uint256 _after = IERC20(_token).balanceOf(address(locker));
		uint256 _net = _after - _before;

		(success, ) = locker.execute(_token, 0, abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _net));
		require(success, "Transfer failed!");
		emit Withdrawn(gauge, _token, 0);
	}

	function sendToAccumulator(address _token, uint256 _amount) external onlyGovernance {
		IERC20(_token).approve(address(accumulator), _amount);
		accumulator.depositToken(_token, _amount);
	}

	function claimerPendingReward(address _token) external view returns (ClaimerReward[] memory) {
		ClaimerReward[] memory pendings = new ClaimerReward[](8);
		address gauge = gauges[_token];
		for (uint8 i; i < 8; i++) {
			address rewardToken = ILiquidityGaugeFRAX(gauge).getAllRewardTokens()[i];
			if (rewardToken == address(0)) {
				break;
			}
			uint256 rewardsBalance = ILiquidityGaugeFRAX(gauge).earned(address(locker))[i];
			uint256 pendingAmount = (rewardsBalance * claimerReward) / BASE_FEE;
			ClaimerReward memory pendingReward = ClaimerReward(rewardToken, pendingAmount);
			pendings[i] = pendingReward;
		}
		return pendings;
	}

	function boost(address _gauge) external override onlyGovernance {
		(bool success, ) = locker.execute(_gauge, 0, abi.encodeWithSignature("user_checkpoint(address)", address(locker)));
		require(success, "Boost failed!");
		emit Boosted(_gauge, address(locker));
	}

	function set_rewards_receiver(address _gauge, address _receiver) external override onlyGovernance {
		(bool success, ) = locker.execute(_gauge, 0, abi.encodeWithSignature("set_rewards_receiver(address)", _receiver));
		require(success, "Set rewards receiver failed!");
		emit RewardReceiverSet(_gauge, _receiver);
	}

	function toggleVault(address _vault) external override onlyGovernance {
		vaults[_vault] = !vaults[_vault];
		emit VaultToggled(_vault, vaults[_vault]);
	}

	function setGauge(address _token, address _gauge) external override onlyGovernance {
		gauges[_token] = _gauge;
		emit GaugeSet(_gauge, _token);
	}

	function setMultiGauge(address _gauge, address _multiGauge) external override onlyGovernance {
		multiGauges[_gauge] = _multiGauge;
	}

	function setVeSDTProxy(address _newVeSDTProxy) external onlyGovernance {
		veSDTFeeProxy = _newVeSDTProxy;
	}

	function setAccumulator(address _newAccumulator) external onlyGovernance {
		accumulator = FxsAccumulator(_newAccumulator);
	}

	function setRewardsReceiver(address _newRewardsReceiver) external onlyGovernance {
		rewardsReceiver = _newRewardsReceiver;
	}

	function manageFee(
		MANAGEFEE _manageFee,
		address _gauge,
		uint256 _newFee
	) external onlyGovernance {
		if (_manageFee == MANAGEFEE.PERFFEE) {
			// 0
			require(_gauge != address(0), "zero address");
			perfFee[_gauge] = _newFee;
		} else if (_manageFee == MANAGEFEE.VESDTFEE) {
			// 1
			veSDTFee = _newFee;
		} else if (_manageFee == MANAGEFEE.ACCUMULATORFEE) {
			//2
			accumulatorFee = _newFee;
		} else if (_manageFee == MANAGEFEE.CLAIMERREWARD) {
			// 3
			claimerReward = _newFee;
		}
	}
}
