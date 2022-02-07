// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface ITokenGaugeController {
	function vote_for_gauge_weights(address, uint256) external;
}
