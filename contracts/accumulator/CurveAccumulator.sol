// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./BaseAccumulator.sol";

/// @title A contract that accumulates 3crv rewards and notifies them to the LGV4
/// @author StakeDAO
contract CurveAccumulator is BaseAccumulator {

	address public constant CRV3 = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490;
	address public constant CRV_FEE_D = 0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc;

	/* ========== CONSTRUCTOR ========== */
	constructor(address _tokenReward) BaseAccumulator(_tokenReward) {}

	/* ========== MUTATIVE FUNCTIONS ========== */
	/// @notice Claims rewards from the locker and notify an amount to the LGV4
	/// @param _amount amount to notify after the claim
	function claimAndNotify(uint256 _amount) external {
		require(locker != address(0), "locker not set");
		ILocker(locker).claimRewards(tokenReward, address(this));
		_notifyReward(tokenReward, _amount);
	}

	/// @notice Claims rewards from the locker and notify all to the LGV4
	function claimAndNotifyAll() external {
		require(locker != address(0), "locker not set");
		ILocker(locker).execute(
			CRV_FEE_D,
			0,
            abi.encodeWithSignature("claim()")
        );
		uint256 crv3Claimed = IERC20(CRV3).balanceOf(locker);
		ILocker(locker).execute(
            CRV3,
            0,
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                address(this),
                crv3Claimed
            )
        );
		//ILocker(locker).claim(address(this));
		_notifyReward(tokenReward, crv3Claimed);
	}
}
