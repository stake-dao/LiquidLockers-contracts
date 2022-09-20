// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

interface IGaugeController {
	struct VotedSlope {
		uint256 slope;
		uint256 power;
		uint256 end;
	}

	//solhint-disable-next-line
	function gauge_types(address addr) external view returns (int128);

	//solhint-disable-next-line
	function gauge_relative_weight_write(address addr, uint256 timestamp) external returns (uint256);

	//solhint-disable-next-line
	function gauge_relative_weight(address addr) external view returns (uint256);

	//solhint-disable-next-line
	function gauge_relative_weight(address addr, uint256 timestamp) external view returns (uint256);

	//solhint-disable-next-line
	function get_total_weight() external view returns (uint256);

	//solhint-disable-next-line
	function get_gauge_weight(address addr) external view returns (uint256);

	function vote_for_gauge_weights(address, uint256) external;

	function vote_user_slopes(address, address) external returns (VotedSlope memory);
}
