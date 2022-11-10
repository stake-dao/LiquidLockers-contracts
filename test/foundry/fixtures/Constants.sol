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
	address public constant SDT_SMART_WALLET_CHECKER = 0x37E8386602d9EBEa2c56dd11d8E142290595f1b5;
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
	address public constant AG_EUR = 0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8;
	address public constant ANGLE_SMART_WALLET_CHECKER = 0xAa241Ccd398feC742f463c534a610529dCC5888E;
	address public constant ANGLE_FEE_DITRIBUTOR = 0x7F82ff050128e29Fd89D85d01b93246F744E62A0;
	address public constant SAN_USDC_EUR = 0x9C215206Da4bf108aE5aEEf9dA7caD3352A36Dad;
	address public constant ANGLE_GAUGE_CONTROLLER = 0x9aD7e7b0877582E14c17702EecF49018DD6f2367;

	////////////////////////////////////////////////////////////////
	/// --- APWINE PROTOCOL
	///////////////////////////////////////////////////////////////
	address public constant APW = 0x4104b135DBC9609Fc1A9490E61369036497660c8;
	address public constant VEAPW = 0xC5ca1EBF6e912E49A6a70Bb0385Ea065061a4F09;
	address public constant APWINE_FEE_DISTRIBUTOR = 0x354743132e75E417344BcfDDed6a045140556414;
	address public constant APWINE_SMART_WALLET_CHECKER = 0xb0463Ba57D6aADf85838f354057F9E4B69BfA4D6;

	////////////////////////////////////////////////////////////////
	/// --- BALANCER PROTOCOL
	///////////////////////////////////////////////////////////////
	address public constant BAL = 0xba100000625a3754423978a60c9317c58a424e3D;
	address public constant BB_A_USD = 0xA13a9247ea42D743238089903570127DdA72fE44;
	address public constant BALANCER_POOL_TOKEN = 0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56;
	address public constant VE_BAL = 0xC128a9954e6c874eA3d62ce62B468bA073093F25;
	address public constant BALANCER_FEE_DISTRIBUTOR = 0x26743984e3357eFC59f2fd6C1aFDC310335a61c9;
	address public constant BALANCER_GAUGE_CONTROLLER = 0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD;
	address public constant BALANCER_SMART_WALLET_CHECKER = 0x7869296Efd0a76872fEE62A058C8fBca5c1c826C;
	address public constant BALANCER_MULTI_SIG = 0x10A19e7eE7d7F8a52822f6817de8ea18204F2e4f;

	////////////////////////////////////////////////////////////////
	/// --- BLACKPOOL PROTOCOL
	///////////////////////////////////////////////////////////////
	address public constant BPT = 0x0eC9F76202a7061eB9b3a7D6B59D36215A7e37da;
	address public constant VEBPT = 0x19886A88047350482990D4EDd0C1b863646aB921;
	address public constant BPT_DAO = 0x07DFF52fb8B38E55E6eCb407913cd847396Af4f0;
	address public constant BPT_SMART_WALLET_CHECKER = 0xadd223B33EF85F79CB2fd0263881FfAb2C93918A;
	address public constant BPT_FEE_DISTRIBUTOR = 0xFf23e40ac05D30Df46c250Dd4d784f6496A79CE9;

	////////////////////////////////////////////////////////////////
	/// --- FRAX PROTOCOL
	///////////////////////////////////////////////////////////////
	address public constant FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;
	address public constant FXS = 0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0;
	address public constant VE_FXS = 0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0;
	address public constant FRAX_SMART_WALLET_CHECKER = 0x53c13BA8834a1567474b19822aAD85c6F90D9f9F;
	address public constant FRAX_YIELD_DISTRIBUTOR = 0xc6764e58b36e26b08Fd1d2AeD4538c02171fA872;
	address public constant FRAX_GAUGE_CONTROLLER = 0x44ade9AA409B0C29463fF7fcf07c9d3c939166ce;
	address public constant FXS_WHALE = 0x322a3fB2f628085749e5F1151AA9A32Eb50D3519;

    ////////////////////////////////////////////////////////////////
    /// --- ANGLE LL
    ///////////////////////////////////////////////////////////////

    address public constant ANGLE_STRATEGY = 0x22635427C72e8b0028FeAE1B5e1957508d9D7CAF;
    address public constant ANGLE_VOTER_V2 = 0xBabe5d223fB31A37ce184481678A6667AC8CD98B;
}
