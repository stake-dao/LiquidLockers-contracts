// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

interface ILiquidityGauge {
    // solhint-disable-next-line
    function deposit_reward_token(address _rewardToken, uint256 _amount) external;
    
    // solhint-disable-next-line
    function claim_rewards_for(address _user, address _recipient) external;

    // // solhint-disable-next-line
    // function claim_rewards_for(address _user) external;

    // solhint-disable-next-line
    function deposit(uint256 _value, address _addr) external;

    // solhint-disable-next-line
    function reward_tokens(uint256 _i) external view returns(address);
}