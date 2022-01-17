// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ITokenGaugeController {
    function vote_for_gauge_weights(address,uint256) external;
}