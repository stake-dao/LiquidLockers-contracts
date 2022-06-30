// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IFXS1559_AMO_V3 {
    function swapBurn(uint256 override_frax_amount, bool use_override) external;
}
