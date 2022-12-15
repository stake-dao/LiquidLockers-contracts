// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface ISurplusConverterSanTokens {
    function buyback(address token, uint256 amount, uint256 minAmount, bool transfer) external;
}
