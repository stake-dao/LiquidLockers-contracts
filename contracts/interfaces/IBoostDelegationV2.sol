// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IBoostDelegationV2 {
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
    event Boost(address indexed _from, address indexed _to, uint256 _bias, uint256 _slope, uint256 _start);
    event Migrate(uint256 indexed _token_id);
    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    function BOOST_V1() external pure returns (address);

    function DOMAIN_SEPARATOR() external pure returns (bytes32);

    function VE() external pure returns (address);

    function adjusted_balance_of(address _user) external view returns (uint256);

    function allowance(address arg0, address arg1) external view returns (uint256);

    function approve(address _spender, uint256 _value) external returns (bool);

    function balanceOf(address _user) external view returns (uint256);

    function boost(address _to, uint256 _amount, uint256 _endtime) external;

    function boost(address _to, uint256 _amount, uint256 _endtime, address _from) external;

    function checkpoint_user(address _user) external;

    function decimals() external pure returns (uint8);

    function decreaseAllowance(address _spender, uint256 _subtracted_value) external returns (bool);

    function delegable_balance(address _user) external view returns (uint256);

    function delegated(address arg0) external view returns (uint256, uint256, uint256);

    function delegated_balance(address _user) external view returns (uint256);

    function delegated_slope_changes(address arg0, uint256 arg1) external view returns (uint256);

    function increaseAllowance(address _spender, uint256 _added_value) external returns (bool);

    function migrate(uint256 _token_id) external;

    function migrated(uint256 arg0) external view returns (bool);

    function name() external pure returns (string memory);

    function nonces(address arg0) external view returns (uint256);

    function permit(
        address _owner,
        address _spender,
        uint256 _value,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external returns (bool);

    function received(address arg0) external view returns (uint256, uint256, uint256);

    function received_balance(address _user) external view returns (uint256);

    function received_slope_changes(address arg0, uint256 arg1) external view returns (uint256);

    function symbol() external pure returns (string memory);

    function totalSupply() external view returns (uint256);
}
