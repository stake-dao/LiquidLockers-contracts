// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";
import "../accumulator/FxsAccumulator.sol";
import "../interfaces/ILiquidityGauge.sol";
import "../interfaces/ILiquidityGaugeFRAX.sol";
import "../staking/SdtDistributorV2.sol";

contract FraxStrategy is BaseStrategy {
	using SafeERC20 for IERC20;
	FxsAccumulator public accumulator;
	address public sdtDistributor;
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
		FxsAccumulator _accumulator,
		address _veSDTFeeProxy,
		address _sdtDistributor
	) BaseStrategy(_locker, _governance, _receiver) {
		accumulator = _accumulator;
		veSDTFeeProxy = _veSDTFeeProxy;
		sdtDistributor = _sdtDistributor;
	}

	/* ========== MUTATIVE FUNCTIONS ========== */

	function deposit(
		address _token,
		uint256 _amount,
		bytes memory _encodedDeposit
	) public onlyApprovedVault returns (bytes32) {
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");

		IERC20(_token).transferFrom(msg.sender, address(locker), _amount);
		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", gauge, 0));
		locker.execute(_token, 0, abi.encodeWithSignature("approve(address,uint256)", gauge, _amount));

		uint256 _lockedLiquidity = ILiquidityGaugeFRAX(gauge).lockedLiquidityOf(address(locker)); // Needed for the calculation of the kekId
		(bool success, ) = locker.execute(gauge, 0, _encodedDeposit);
		require(success, "Deposit failed!");

		// Fetching the kekid directly form the calling of the stakeLocked function
		// with result from execute seems not working. Can be proposed : two Solutions :
		// 1.
		uint256 _lockedStakeLength = ILiquidityGaugeFRAX(gauge).lockedStakesOfLength(address(locker));
		bytes32 _kekId = ILiquidityGaugeFRAX(gauge).lockedStakesOf(address(locker))[_lockedStakeLength - 1].kek_id;
		// 2.
		bytes32 _kekIdCalculated = keccak256(abi.encodePacked(address(locker), block.timestamp, _amount, _lockedLiquidity));
		// Idea : second seems better

		require(_kekId == _kekIdCalculated, "Kekid calculation failed");
		emit Deposited(gauge, _token, _amount);
		return (_kekId);
	}

	function withdraw(address _token, bytes memory _encodedWithdraw) public onlyApprovedVault {
		uint256 _before = IERC20(_token).balanceOf(address(locker));
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");

		(bool success, ) = locker.execute(gauge, 0, _encodedWithdraw);
		require(success, "Withdraw failed!");
		
		// Only if the Frax gauge cannot send LP token directly to the vault
		uint256 _after = IERC20(_token).balanceOf(address(locker));
		uint256 _net = _after - _before;
		if (_net > 0) {
			(success, ) = locker.execute(_token, 0, abi.encodeWithSignature("transfer(address,uint256)", msg.sender, _net));
			require(success, "Transfer failed!");
		}
		emit Withdrawn(gauge, _token, 0);
	}

	function claim(address _token) external override {
		address gauge = gauges[_token];
		require(gauge != address(0), "!gauge");
		//(bool success, ) = locker.execute(gauge, 0, abi.encodeWithSignature("user_checkpoint(address)", address(locker)));
		//require(success, "Checkpoint failed!");
		(bool success, ) = locker.execute(
			gauge,
			0,
			abi.encodeWithSignature("getReward(address)", address(this))
		);
		require(success, "Claim failed!");
		SdtDistributorV2(sdtDistributor).distribute(multiGauges[gauge]);
		address[] memory rewardTokenList = ILiquidityGaugeFRAX(gauge).getAllRewardTokens();
		for (uint8 i = 0; i < rewardTokenList.length; i++) {
			address rewardToken = rewardTokenList[i];
			if (rewardToken == address(0)) {
				break;
			}
			
			uint256 rewardsBalance = IERC20(rewardToken).balanceOf(address(this));
			if (rewardsBalance == 0) { continue; }

			uint256 multisigFee = (rewardsBalance * perfFee[gauge]) / BASE_FEE;
			uint256 accumulatorPart = (rewardsBalance * accumulatorFee[gauge]) / BASE_FEE;
			uint256 veSDTPart = (rewardsBalance * veSDTFee[gauge]) / BASE_FEE;
			uint256 claimerPart = (rewardsBalance * claimerRewardFee[gauge]) / BASE_FEE;
			IERC20(rewardToken).approve(address(accumulator), accumulatorPart);
			accumulator.depositToken(rewardToken, accumulatorPart);
			IERC20(rewardToken).transfer(rewardsReceiver, multisigFee);
			IERC20(rewardToken).transfer(veSDTFeeProxy, veSDTPart);
			IERC20(rewardToken).transfer(msg.sender, claimerPart);
			uint256 netRewards = rewardsBalance - multisigFee - accumulatorPart - veSDTPart - claimerPart;
			IERC20(rewardToken).approve(multiGauges[gauge], netRewards);
			//ILiquidityGauge(multiGauges[gauge]).deposit_reward_token(rewardToken, netRewards);
			emit Claimed(gauge, rewardToken, rewardsBalance);
		}
	}

	function claimerPendingRewards(address _token) external view returns (ClaimerReward[] memory) {
		ClaimerReward[] memory pendings = new ClaimerReward[](8);
		address gauge = gauges[_token];
		for (uint8 i = 0; i < 8; i++) {
			address rewardToken = ILiquidityGauge(gauge).reward_tokens(i);
			if (rewardToken == address(0)) {
				break;
			}
			uint256 rewardsBalance = ILiquidityGauge(gauge).claimable_reward(address(locker), rewardToken);
			uint256 pendingAmount = (rewardsBalance * claimerRewardFee[gauge]) / BASE_FEE;
			ClaimerReward memory pendingReward = ClaimerReward(rewardToken, pendingAmount);
			pendings[i] = pendingReward;
		}
		return pendings;
	}

	function toggleVault(address _vault) external override onlyGovernanceOrFactory {
		vaults[_vault] = !vaults[_vault];
		emit VaultToggled(_vault, vaults[_vault]);
	}

	function setGauge(address _token, address _gauge) external override onlyGovernanceOrFactory {
		gauges[_token] = _gauge;
		emit GaugeSet(_gauge, _token);
	}

	function setMultiGauge(address _gauge, address _multiGauge) external override onlyGovernanceOrFactory {
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

	function setGovernance(address _newGovernance) external onlyGovernance {
		governance = _newGovernance;
	}

	function setSdtDistributor(address _newSdtDistributor) external onlyGovernance {
		sdtDistributor = _newSdtDistributor;
	}

	function setVaultGaugeFactory(address _newVaultGaugeFactory) external onlyGovernance {
		require(_newVaultGaugeFactory != address(0), "zero address");
		vaultGaugeFactory = _newVaultGaugeFactory;
	}

	/// @notice function to set new fees
	/// @param _manageFee manageFee
	/// @param _gauge gauge address
	/// @param _newFee new fee to set
	function manageFee(
		MANAGEFEE _manageFee,
		address _gauge,
		uint256 _newFee
	) external onlyGovernanceOrFactory {
		require(_gauge != address(0), "zero address");
		require(_newFee <= BASE_FEE, "fee to high");
		if (_manageFee == MANAGEFEE.PERFFEE) {
			// 0
			perfFee[_gauge] = _newFee;
		} else if (_manageFee == MANAGEFEE.VESDTFEE) {
			// 1
			veSDTFee[_gauge] = _newFee;
		} else if (_manageFee == MANAGEFEE.ACCUMULATORFEE) {
			//2
			accumulatorFee[_gauge] = _newFee;
		} else if (_manageFee == MANAGEFEE.CLAIMERREWARD) {
			// 3
			claimerRewardFee[_gauge] = _newFee;
		}
	}

	/// @notice execute a function
	/// @param to Address to sent the value to
	/// @param value Value to be sent
	/// @param data Call function data
	function execute(
		address to,
		uint256 value,
		bytes calldata data
	) external onlyGovernance returns (bool, bytes memory) {
		(bool success, bytes memory result) = to.call{ value: value }(data);
		return (success, result);
	}
}
