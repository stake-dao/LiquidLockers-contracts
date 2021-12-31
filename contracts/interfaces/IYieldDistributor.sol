// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.6.12;

interface IYieldDistributor {
    function getYield() external returns (uint256);

    function checkpoint() external;
}