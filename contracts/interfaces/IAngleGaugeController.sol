// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IAngleGaugeController {
	function vote_for_gauge_weights(address,uint256) external;

  function vote(uint256, bool, bool) external; //voteId, support, executeIfDecided
}