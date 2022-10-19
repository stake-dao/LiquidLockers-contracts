// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

library Constants {
	////////////////////////////////////////////////////////////////
	/// --- COMMONS
	///////////////////////////////////////////////////////////////

	uint256 public constant DAY = 1 days;
	uint256 public constant WEEK = 7 days;
	uint256 public constant YEAR = 365 days;

	address public constant ZERO_ADDRESS = address(0);
	address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
	address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
	address public constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
	address public constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

	////////////////////////////////////////////////////////////////
	/// --- YEARN FINANCE
	///////////////////////////////////////////////////////////////

	address public constant YFI = 0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e;

	////////////////////////////////////////////////////////////////
	/// --- STAKE DAO ADDRESSES
	///////////////////////////////////////////////////////////////

	address public constant STAKE_DAO_MULTISIG = 0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0;

	address public constant SDT = 0x73968b9a57c6E53d41345FD57a6E6ae27d6CDB2F;
	address public constant VE_SDT = 0x0C30476f66034E11782938DF8e4384970B6c9e8a;
	address public constant SDT_DISTRIBUTOR = 0x06F66Bc79aeD1b49a393bF5fcF68a70499A2B5DC;
	address public constant SDT_DISTRIBUTOR_STRAT = 0x9C99dffC1De1AfF7E7C1F36fCdD49063A281e18C;
	address public constant VE_SDT_BOOST_PROXY = 0xD67bdBefF01Fc492f1864E61756E5FBB3f173506;
	address public constant TIMELOCK = 0xD3cFc4E65a73BB6C482383EB38f5C3E1d1411616;
	address public constant STDDEPLOYER = 0xb36a0671B3D49587236d7833B01E79798175875f;
	address public constant SDTNEWDEPLOYER = 0x0dE5199779b43E13B3Bec21e91117E18736BC1A8;
	address public constant MASTERCHEF = 0xfEA5E213bbD81A8a94D0E1eDB09dBD7CEab61e1c;
	address public constant FEE_D_SD = 0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92;
	address public constant PROXY_ADMIN = 0xfE612c237A81527a86f2Cac1FD19939CF4F91B9B;

	////////////////////////////////////////////////////////////////
	/// --- ANGLE PROTOCOL
	///////////////////////////////////////////////////////////////
	address public constant ANGLE = 0x31429d1856aD1377A8A0079410B297e1a9e214c2;
	address public constant VEANGLE = 0x0C462Dbb9EC8cD1630f1728B2CFD2769d09f0dd5;
	address public constant ANGLE_SMART_WALLET_CHECKER = 0xAa241Ccd398feC742f463c534a610529dCC5888E;
	address public constant ANGLE_FEE_DITRIBUTOR = 0x7F82ff050128e29Fd89D85d01b93246F744E62A0;
	address public constant SAN_USDC_EUR = 0x9C215206Da4bf108aE5aEEf9dA7caD3352A36Dad;
	address public constant ANGLE_GAUGE_CONTROLLER = 0x9aD7e7b0877582E14c17702EecF49018DD6f2367;

	////////////////////////////////////////////////////////////////
	/// --- BLACKPOOL PROTOCOL
	///////////////////////////////////////////////////////////////
	address public constant BPT = 0x0eC9F76202a7061eB9b3a7D6B59D36215A7e37da;
	address public constant VEBPT = 0x19886A88047350482990D4EDd0C1b863646aB921;
	address public constant BPT_DAO = 0x07DFF52fb8B38E55E6eCb407913cd847396Af4f0;
	address public constant BPT_SMART_WALLET_CHECKER = 0xadd223B33EF85F79CB2fd0263881FfAb2C93918A;
	address public constant BPT_FEE_DISTRIBUTOR = 0xFf23e40ac05D30Df46c250Dd4d784f6496A79CE9;
}
