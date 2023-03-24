pragma solidity 0.8.7;

interface IPendleFeeDistributor {
    event AdminChanged(address previousAdmin, address newAdmin);
    event BeaconUpgraded(address indexed beacon);
    event ClaimReward(
        address indexed pool,
        address indexed user,
        uint256 wTime,
        uint256 amount
    );
    event Initialized(uint8 version);
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event PoolAdded(address indexed pool, uint256 indexed startWeek);
    event UpdateFee(
        address indexed pool,
        uint256 indexed wTime,
        uint256 amount
    );
    event Upgraded(address indexed implementation);

    function addPool(address pool, uint256 _startWeek) external;

    function allPools(uint256) external view returns (address);

    function claimOwnership() external;

    function claimReward(
        address user,
        address[] memory pools
    ) external returns (uint256[] memory amountRewardOut);

    function fees(address, uint256) external view returns (uint256);

    function fund(
        address[] memory pools,
        uint256[][] memory wTimes,
        uint256[][] memory amounts,
        uint256 totalAmountToFund
    ) external;

    function getAllActivePools() external view returns (address[] memory);

    function getAllPools() external view returns (address[] memory);

    function initialize() external;

    function lastFundedWeek(address) external view returns (uint256);

    function owner() external view returns (address);

    function pendingOwner() external view returns (address);

    function proxiableUUID() external view returns (bytes32);

    function token() external view returns (address);

    function transferOwnership(
        address newOwner,
        bool direct,
        bool renounce
    ) external;

    function upgradeTo(address newImplementation) external;

    function upgradeToAndCall(
        address newImplementation,
        bytes memory data
    ) external payable;

    function userInfo(
        address,
        address
    ) external view returns (uint128 firstUnclaimedWeek, uint128 iter);

    function vePendle() external view returns (address);

    function votingController() external view returns (address);
}
