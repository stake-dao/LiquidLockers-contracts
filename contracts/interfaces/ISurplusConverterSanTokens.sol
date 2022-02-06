interface ISurplusConverterSanTokens {
	function buyback(
		address token,
		uint256 amount,
		uint256 minAmount,
		bool transfer
	) external;
}
