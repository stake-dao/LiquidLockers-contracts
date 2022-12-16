// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IBoostDelegationProxy {
    event ApplyAdmin(address admin);
    event CommitAdmin(address admin);
    event DelegationSet(address delegation);

    function accept_transfer_ownership() external;

    function adjusted_balance_of(address _account) external view returns (uint256);

    function admin() external view returns (address);

    function commit_admin(address _admin) external;

    function delegation() external view returns (address);

    function future_admin() external view returns (address);

    function kill_delegation() external;

    function set_delegation(address _delegation) external;

    function voting_escrow() external view returns (address);
}
