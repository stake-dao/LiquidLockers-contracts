// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "../baseTest/Base.t.sol";

// Contract
import "contracts/lockers/FxsLocker.sol";
import "contracts/accumulators/FxsAccumulator.sol";
import "contracts/depositors/Depositor.sol";

import "contracts/tokens/sdToken.sol";
import "contracts/external/ProxyAdmin.sol";
import "contracts/external/TransparentUpgradeableProxy.sol";
import "contracts/sdtDistributor/SdtDistributorV2.sol";
import "contracts/sdtDistributor/MasterchefMasterToken.sol";

// Interface
import "contracts/interfaces/IVeFXS.sol";

import "contracts/interfaces/ISmartWalletChecker.sol";
import "contracts/interfaces/ILiquidityGauge.sol";
import "contracts/interfaces/IGaugeController.sol";
import "contracts/interfaces/IMasterchef.sol";

/// @dev `deal` function from foundry doesn't work properly with FXS token
contract FraxTest is BaseTest {
    address internal constant LOCAL_DEPLOYER = address(0xDE);
    address internal constant ALICE = address(0xAA);
    address internal token = AddressBook.FXS;
    address internal veToken = AddressBook.VE_FXS;
    address internal yieldDistributor = AddressBook.FRAX_YIELD_DISTRIBUTOR;
    address internal fraxGaugeController = AddressBook.FRAX_GAUGE_CONTROLLER;
    address[] internal rewardsToken;

    uint256 internal constant INITIAL_AMOUNT_TO_LOCK = 10e18;
    uint256 internal constant INITIAL_PERIOD_TO_LOCK = 60 * 60 * 24 * 365 * 4;
    uint256 internal constant EXTRA_AMOUNT_TO_LOCK = 1e18;
    uint256 internal constant EXTRA_PERIOD_TO_LOCK = 60 * 60 * 24 * 365 * 1; //150 days
    uint256 internal constant ACCUMULATOR_CLAIMER_FEE = 100; // 1%
    uint256 internal constant LOCK_MULTIPLIER = 4;
    uint256[] internal rewardsAmount;

    sdToken internal _sdToken;
    ProxyAdmin internal proxyAdmin;
    FxsLocker internal locker;
    Depositor internal depositor;
    FxsAccumulator internal accumulator;
    SdtDistributorV2 internal sdtDistributor;
    SdtDistributorV2 internal sdtDistributorImpl;
    MasterchefMasterToken internal masterChefToken;
    TransparentUpgradeableProxy internal proxy;

    IVeToken internal veSDT;
    IMasterchef internal masterchef;
    ILiquidityGauge internal liquidityGauge;
    ILiquidityGauge internal liquidityGaugeImpl;
    IGaugeController internal gaugeController;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"));
        vm.selectFork(forkId);

        rewardsToken.push(AddressBook.FXS);
        rewardsAmount.push(2e18);

        vm.startPrank(LOCAL_DEPLOYER);
        ////////////////////////////////////////////////////////////////
        /// --- START DEPLOYEMENT
        ///////////////////////////////////////////////////////////////
        proxyAdmin = new ProxyAdmin();

        // Deploy Locker
        locker = new FxsLocker(address(this));

        // Deploy sdToken
        _sdToken = new sdToken("Stake DAO FXS", "_sdToken");

        // Deploy Depositor
        depositor = new Depositor(token, address(locker), address(_sdToken));

        // Deploy Accumulator
        accumulator = new FxsAccumulator(rewardsToken[0], address(0));

        // Deploy Gauge Controller
        gaugeController = IGaugeController(
            deployCode(
                "artifacts/vyper-contracts/GaugeController.vy/GaugeController.json",
                abi.encode(AddressBook.SDT, AddressBook.VE_SDT, LOCAL_DEPLOYER)
            )
        );

        // Deploy SDT Distributor
        veSDT = IVeToken(AddressBook.VE_SDT);
        bytes memory sdtDistributorData = abi.encodeWithSignature(
            "initialize(address,address,address,address)",
            address(gaugeController),
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER,
            LOCAL_DEPLOYER
        );
        sdtDistributorImpl = new SdtDistributorV2();
        proxy = new TransparentUpgradeableProxy(address(sdtDistributorImpl), address(proxyAdmin), sdtDistributorData);
        sdtDistributor = SdtDistributorV2(address(proxy));

        // Masterchef
        masterchef = IMasterchef(AddressBook.MASTERCHEF);
        masterChefToken = MasterchefMasterToken(address(sdtDistributor.masterchefToken()));

        // Deploy Liquidity Gauge V4
        bytes memory lgData = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,address)",
            address(_sdToken),
            LOCAL_DEPLOYER,
            AddressBook.SDT,
            AddressBook.VE_SDT,
            AddressBook.VE_SDT_BOOST_PROXY, // to mock
            address(sdtDistributor)
        );
        liquidityGaugeImpl =
            ILiquidityGauge(deployCode("artifacts/vyper-contracts/LiquidityGaugeV4.vy/LiquidityGaugeV4.json"));
        proxy = new TransparentUpgradeableProxy(address(liquidityGaugeImpl), address(proxyAdmin), lgData);
        liquidityGauge = ILiquidityGauge(address(proxy));
        ////////////////////////////////////////////////////////////////
        /// --- END DEPLOYEMENT
        ///////////////////////////////////////////////////////////////
        vm.stopPrank();
        vm.prank(0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063);
        ISmartWalletChecker(AddressBook.SDT_SMART_WALLET_CHECKER).approveWallet(LOCAL_DEPLOYER);
        vm.prank(ISmartWalletChecker(AddressBook.FRAX_SMART_WALLET_CHECKER).owner());
        ISmartWalletChecker(AddressBook.FRAX_SMART_WALLET_CHECKER).approveWallet(address(locker));

        // Add masterchef token to masterchef
        vm.prank(masterchef.owner());
        masterchef.add(1000, IERC20(address(masterChefToken)), false);

        lockSDT(LOCAL_DEPLOYER);
        vm.startPrank(LOCAL_DEPLOYER);
        sdtDistributor.initializeMasterchef(masterchef.poolLength() - 1);
        sdtDistributor.setDistribution(true);
        sdtDistributor.approveGauge(address(liquidityGauge));
        _sdToken.setOperator(address(depositor));
        locker.setFxsDepositor(address(depositor));
        locker.setAccumulator(address(accumulator));
        depositor.setGauge(address(liquidityGauge));
        accumulator.setGauge(address(liquidityGauge));
        accumulator.setClaimerFee(ACCUMULATOR_CLAIMER_FEE);
        accumulator.setSdtDistributor(address(sdtDistributor));
        accumulator.setLocker(address(locker));
        liquidityGauge.add_reward(rewardsToken[0], address(accumulator));
        gaugeController.add_type("Mainnet staking", 1e18);
        gaugeController.add_gauge(address(liquidityGauge), 0, 0);
        gaugeController.vote_for_gauge_weights(address(liquidityGauge), 10000);
        vm.stopPrank();
    }

    //function testNothing() public {}

    ////////////////////////////////////////////////////////////////
    /// --- LOCKER
    ///////////////////////////////////////////////////////////////
    function testLocker01createLock() public {
        bytes memory createLockCallData = abi.encodeWithSignature(
            "createLock(uint256,uint256)", INITIAL_AMOUNT_TO_LOCK, block.timestamp + INITIAL_PERIOD_TO_LOCK
        );
        dealFXS(address(locker), INITIAL_AMOUNT_TO_LOCK);
        createLock(
            LOCAL_DEPLOYER,
            address(locker),
            veToken,
            INITIAL_AMOUNT_TO_LOCK,
            INITIAL_PERIOD_TO_LOCK,
            LOCK_MULTIPLIER,
            createLockCallData
        );
    }

    function testLocker02IncreaseLockAmount() public {
        testLocker01createLock();
        bytes memory increaseAmountCallData = abi.encodeWithSignature("increaseAmount(uint256)", EXTRA_AMOUNT_TO_LOCK);
        dealFXS(address(locker), EXTRA_AMOUNT_TO_LOCK);
        increaseAmount(LOCAL_DEPLOYER, address(locker), veToken, EXTRA_AMOUNT_TO_LOCK, increaseAmountCallData);
    }

    function testLocker03IncreaseLockDuration() public {
        testLocker01createLock();
        timeJump(EXTRA_PERIOD_TO_LOCK);
        bytes memory increaseLockCallData =
            abi.encodeWithSignature("increaseUnlockTime(uint256)", block.timestamp + INITIAL_PERIOD_TO_LOCK);
        increaseLock(LOCAL_DEPLOYER, address(locker), veToken, EXTRA_PERIOD_TO_LOCK, increaseLockCallData);
    }

    function testLocker04Release() public {
        testLocker01createLock();
        timeJump(INITIAL_PERIOD_TO_LOCK);
        bytes memory releaseCallData = abi.encodeWithSignature("release(address)", address(this));
        release(LOCAL_DEPLOYER, address(locker), token, address(this), INITIAL_AMOUNT_TO_LOCK, releaseCallData);
    }

    function testLocker05ClaimReward() public {
        testLocker01createLock();
        bytes[] memory listCallData = new bytes[](1);
        address rewardsReceiver = address(this);
        listCallData[0] = abi.encodeWithSignature("claimFXSRewards(address)", rewardsReceiver);
        //simulateRewards(rewardsToken, rewardsAmount, yieldDistributor);
        dealFXS(yieldDistributor, rewardsAmount[0]);
        timeJump(2 weeks);
        claimReward(LOCAL_DEPLOYER, address(locker), rewardsToken, rewardsReceiver, listCallData);
    }

    function testLocker06Execute() public {
        bytes memory data = abi.encodeWithSignature("name()");
        bytes memory executeCallData = abi.encodeWithSignature("execute(address,uint256,bytes)", token, 0, data);
        execute(LOCAL_DEPLOYER, address(locker), executeCallData);
    }

    function testLocker07SetAccumulator() public {
        bytes memory setAccumulatorCallData = abi.encodeWithSignature("setAccumulator(address)", address(0xA));
        bytes memory accumulatorCallData = abi.encodeWithSignature("accumulator()");
        setter(
            LOCAL_DEPLOYER, address(locker), address(locker), address(0xA), setAccumulatorCallData, accumulatorCallData
        );
    }

    function testLocker08SetGovernance() public {
        bytes memory setGovernanceCallData = abi.encodeWithSignature("setGovernance(address)", address(0xA));
        bytes memory governanceCallData = abi.encodeWithSignature("governance()");
        setter(
            LOCAL_DEPLOYER, address(locker), address(locker), address(0xA), setGovernanceCallData, governanceCallData
        );
    }

    function testLocker09SetDepositor() public {
        bytes memory setDepositorCallData = abi.encodeWithSignature("setFxsDepositor(address)", address(0xA));
        bytes memory depositorCallData = abi.encodeWithSignature("fxsDepositor()");
        setter(LOCAL_DEPLOYER, address(locker), address(locker), address(0xA), setDepositorCallData, depositorCallData);
    }

    function testLocker10SetYieldDistributor() public {
        bytes memory setFeeDistributorCallData = abi.encodeWithSignature("setYieldDistributor(address)", address(0xA));
        bytes memory feeDistributorCallData = abi.encodeWithSignature("yieldDistributor()");
        setter(
            LOCAL_DEPLOYER,
            address(locker),
            address(locker),
            address(0xA),
            setFeeDistributorCallData,
            feeDistributorCallData
        );
    }

    function testLocker12SetGaugeController() public {
        bytes memory setGaugeControllerCallData = abi.encodeWithSignature("setGaugeController(address)", address(0xA));
        bytes memory gaugeControllerCallData = abi.encodeWithSignature("gaugeController()");
        setter(
            LOCAL_DEPLOYER,
            address(locker),
            address(locker),
            address(0xA),
            setGaugeControllerCallData,
            gaugeControllerCallData
        );
    }

    function testLocker13VoteForGauge() public {
        testLocker01createLock();
        address gauge = IGaugeController(fraxGaugeController).gauges(0);
        bytes memory voteGaugeCallData = abi.encodeWithSignature("voteGaugeWeight(address,uint256)", gauge, 10000);
        voteForGauge(LOCAL_DEPLOYER, address(locker), fraxGaugeController, gauge, voteGaugeCallData);
    }

    function testLocker14Revert() public {
        uint8 i = 3;
        // callData
        bytes[] memory listCallData = new bytes[](i);
        listCallData[0] = abi.encodeWithSignature(
            "createLock(uint256,uint256)", INITIAL_AMOUNT_TO_LOCK, block.timestamp + INITIAL_PERIOD_TO_LOCK
        );
        listCallData[1] = abi.encodeWithSignature("increaseAmount(uint256)", EXTRA_AMOUNT_TO_LOCK);
        listCallData[2] = abi.encodeWithSignature("claimFXSRewards(address)", address(0x1));

        // Revert reasons
        bytes[] memory listRevertReason = new bytes[](i);
        listRevertReason[0] = bytes("!gov");
        listRevertReason[1] = bytes("!(gov||fxsDepositor)");
        listRevertReason[2] = bytes("!(gov||acc)");

        // Caller
        address[] memory listCaller = new address[](i);
        listCaller[0] = address(0xB0B);
        listCaller[1] = address(0xB0B);
        listCaller[2] = address(0xB0B);

        reverter(listCaller, address(locker), listCallData, listRevertReason);
    }

    ////////////////////////////////////////////////////////////////
    /// --- DEPOSITOR
    ///////////////////////////////////////////////////////////////
    function testDepositor01LockToken() public {
        testLocker01createLock();
        uint256 waitBeforeLock = 60 * 60 * 24 * 10;
        uint256 incentiveAmount = 2e16;
        dealFXS(address(depositor), INITIAL_AMOUNT_TO_LOCK);
        bytes memory lockTokenCallData = abi.encodeWithSignature("lockToken()");
        lockToken(
            LOCAL_DEPLOYER,
            address(locker),
            address(depositor),
            token,
            veToken,
            address(_sdToken),
            INITIAL_AMOUNT_TO_LOCK,
            incentiveAmount,
            waitBeforeLock,
            lockTokenCallData
        );
    }

    function testDepositor01LockNoToken() public {
        testLocker01createLock();
        uint256 waitBeforeLock = 60 * 60 * 24 * 10;
        dealFXS(address(depositor), 0);
        bytes memory lockTokenCallData = abi.encodeWithSignature("lockToken()");
        lockToken(
            LOCAL_DEPLOYER,
            address(locker),
            address(depositor),
            token,
            veToken,
            address(_sdToken),
            0,
            0,
            waitBeforeLock,
            lockTokenCallData
        );
    }

    function testDepositor02DepositLockStake() public {
        testLocker01createLock();
        uint256 waitBeforeLock = 60 * 60 * 24 * 10;
        uint256 amountToDeposit = 1e18;
        uint256 incentiveAmount = 2e16;
        bool lock = true;
        bool stake = true;
        address user = ALICE;
        bytes memory depositCallData =
            abi.encodeWithSignature("deposit(uint256,bool,bool,address)", amountToDeposit, lock, stake, user);
        //deal(token, user, amountToDeposit);
        dealFXS(user, amountToDeposit);
        vm.prank(user);
        IERC20(token).approve(address(depositor), amountToDeposit);
        deposit(
            ALICE,
            address(depositor),
            token,
            address(_sdToken),
            user,
            amountToDeposit,
            incentiveAmount,
            waitBeforeLock,
            lock,
            stake,
            depositCallData
        );
    }

    function testDepositor02DepositNoLockStake() public {
        testLocker01createLock();
        uint256 waitBeforeLock = 60 * 60 * 24 * 10;
        uint256 amountToDeposit = 1e18;
        uint256 incentiveAmount = 2e16;
        bool lock = false;
        bool stake = true;
        address user = ALICE;
        bytes memory depositCallData =
            abi.encodeWithSignature("deposit(uint256,bool,bool,address)", amountToDeposit, lock, stake, user);
        dealFXS(user, amountToDeposit);
        vm.prank(user);
        IERC20(token).approve(address(depositor), amountToDeposit);
        deposit(
            ALICE,
            address(depositor),
            token,
            address(_sdToken),
            user,
            amountToDeposit,
            incentiveAmount,
            waitBeforeLock,
            lock,
            stake,
            depositCallData
        );
    }

    function testDepositor02DepositLockNoStake() public {
        testLocker01createLock();
        uint256 waitBeforeLock = 60 * 60 * 24 * 10;
        uint256 amountToDeposit = 1e18;
        uint256 incentiveAmount = 2e16;
        bool lock = true;
        bool stake = false;
        address user = ALICE;
        bytes memory depositCallData =
            abi.encodeWithSignature("deposit(uint256,bool,bool,address)", amountToDeposit, lock, stake, user);
        dealFXS(user, amountToDeposit);
        vm.prank(user);
        IERC20(token).approve(address(depositor), amountToDeposit);
        deposit(
            ALICE,
            address(depositor),
            token,
            address(_sdToken),
            user,
            amountToDeposit,
            incentiveAmount,
            waitBeforeLock,
            lock,
            stake,
            depositCallData
        );
    }

    function testDepositor02DepositNoLockNoStake() public {
        testLocker01createLock();
        uint256 waitBeforeLock = 60 * 60 * 24 * 10;
        uint256 amountToDeposit = 1e18;
        uint256 incentiveAmount = 2e16;
        bool lock = false;
        bool stake = false;
        address user = ALICE;
        bytes memory depositCallData =
            abi.encodeWithSignature("deposit(uint256,bool,bool,address)", amountToDeposit, lock, stake, user);
        dealFXS(user, amountToDeposit);
        vm.prank(user);
        IERC20(token).approve(address(depositor), amountToDeposit);
        deposit(
            ALICE,
            address(depositor),
            token,
            address(_sdToken),
            user,
            amountToDeposit,
            incentiveAmount,
            waitBeforeLock,
            lock,
            stake,
            depositCallData
        );
    }

    function testDepositor03DepositAll() public {
        testLocker01createLock();
        uint256 waitBeforeLock = 60 * 60 * 24 * 10;
        uint256 amountToDeposit = 1e18;
        uint256 incentiveAmount = 2e16;
        bool lock = true;
        bool stake = false;
        address user = ALICE;
        bytes memory depositCallData = abi.encodeWithSignature("depositAll(bool,bool,address)", lock, stake, user);
        dealFXS(user, amountToDeposit);
        vm.prank(user);
        IERC20(token).approve(address(depositor), amountToDeposit);
        deposit(
            ALICE,
            address(depositor),
            token,
            address(_sdToken),
            user,
            amountToDeposit,
            incentiveAmount,
            waitBeforeLock,
            lock,
            stake,
            depositCallData
        );
    }

    function testDepositor03SetGovernance() public {
        bytes memory setGovernanceCallData = abi.encodeWithSignature("setGovernance(address)", address(0xA));
        bytes memory governanceCallData = abi.encodeWithSignature("governance()");
        setter(
            LOCAL_DEPLOYER,
            address(depositor),
            address(depositor),
            address(0xA),
            setGovernanceCallData,
            governanceCallData
        );
    }

    function testDepositor04SetSdTokenOperator() public {
        bytes memory setSdTokenOperatorCallData = abi.encodeWithSignature("setSdTokenOperator(address)", address(0xA));
        bytes memory sdTokenOperatorCallData = abi.encodeWithSignature("operator()");
        setter(
            LOCAL_DEPLOYER,
            address(depositor),
            address(_sdToken),
            address(0xA),
            setSdTokenOperatorCallData,
            sdTokenOperatorCallData
        );
    }

    function testDepositor05SetRelock() public {
        bytes memory setRelockCallData = abi.encodeWithSignature("setRelock(bool)", false);
        bytes memory relockCallData = abi.encodeWithSignature("relock()");
        setter(LOCAL_DEPLOYER, address(depositor), address(depositor), false, setRelockCallData, relockCallData);
    }

    function testDepositor06SetGauge() public {
        bytes memory setGaugeCallData = abi.encodeWithSignature("setGauge(address)", address(0xA));
        bytes memory gaugeCallData = abi.encodeWithSignature("gauge()");
        setter(LOCAL_DEPLOYER, address(depositor), address(depositor), address(0xA), setGaugeCallData, gaugeCallData);
    }

    function testDepositor07SetFees() public {
        bytes memory setFeesCallData = abi.encodeWithSignature("setFees(uint256)", 10);
        bytes memory feesCallData = abi.encodeWithSignature("lockIncentive()");
        setter(LOCAL_DEPLOYER, address(depositor), address(depositor), 10, setFeesCallData, feesCallData);
    }

    function testDepositor08Revert() public {
        uint8 i = 3;
        // callData
        bytes[] memory listCallData = new bytes[](i);
        listCallData[0] = abi.encodeWithSignature("setGovernance(address)", address(0x1));
        listCallData[1] = abi.encodeWithSignature("deposit(uint256,bool,bool,address)", 0, true, true, address(0x1));
        listCallData[2] = abi.encodeWithSignature("deposit(uint256,bool,bool,address)", 10, true, true, address(0));

        // Revert reasons
        bytes[] memory listRevertReason = new bytes[](i);
        listRevertReason[0] = bytes("!auth");
        listRevertReason[1] = bytes("!>0");
        listRevertReason[2] = bytes("!user");

        // Caller
        address[] memory listCaller = new address[](i);
        listCaller[0] = address(0xB0B);
        listCaller[1] = LOCAL_DEPLOYER;
        listCaller[2] = LOCAL_DEPLOYER;

        reverter(listCaller, address(depositor), listCallData, listRevertReason);
    }

    ////////////////////////////////////////////////////////////////
    /// --- BASE ACCUMULATOR
    ///////////////////////////////////////////////////////////////
    // Needed for 100% coverage
    function testBaseAccumulator00NotifyExtraReward0() public {
        uint256 amountToNotify = 0;
        bytes memory notityExtraRewardCallData =
            abi.encodeWithSignature("notifyExtraReward(address,uint256)", rewardsToken[0], amountToNotify);
        timeJump(60 * 60 * 24 * 7);
        notifyExtraReward(
            LOCAL_DEPLOYER,
            address(accumulator),
            rewardsToken[0],
            address(liquidityGauge),
            amountToNotify,
            notityExtraRewardCallData
        );
    }

    function testBaseAccumulator01NotifyExtraReward() public {
        uint256 amountToNotify = 1e18;
        bytes memory notityExtraRewardCallData =
            abi.encodeWithSignature("notifyExtraReward(address,uint256)", rewardsToken[0], amountToNotify);
        timeJump(60 * 60 * 24 * 7);
        dealFXS(address(accumulator), amountToNotify);

        notifyExtraReward(
            LOCAL_DEPLOYER,
            address(accumulator),
            rewardsToken[0],
            address(liquidityGauge),
            amountToNotify,
            notityExtraRewardCallData
        );
    }

    function testBaseAccumulator02NotifyAllExtraReward() public {
        uint256 amountToNotify = 1e18;
        bytes memory notityExtraRewardCallData =
            abi.encodeWithSignature("notifyAllExtraReward(address)", rewardsToken[0]);
        timeJump(60 * 60 * 24 * 7);
        dealFXS(address(accumulator), amountToNotify);
        notifyExtraReward(
            LOCAL_DEPLOYER,
            address(accumulator),
            rewardsToken[0],
            address(liquidityGauge),
            amountToNotify,
            notityExtraRewardCallData
        );
    }

    function testBaseAccumulator03NotifyExtraRewards() public {
        bytes memory notityExtraRewardCallData =
            abi.encodeWithSignature("notifyExtraReward(address[],uint256[])", rewardsToken, rewardsAmount);
        timeJump(60 * 60 * 24 * 7);
        dealFXS(address(accumulator), rewardsAmount[0]);
        notifyExtraReward(
            LOCAL_DEPLOYER,
            address(accumulator),
            rewardsToken,
            address(liquidityGauge),
            rewardsAmount,
            notityExtraRewardCallData
        );
    }

    function testBaseAccumulator04NotifyExtraRewards() public {
        bytes memory notityExtraRewardCallData =
            abi.encodeWithSignature("notifyAllExtraReward(address[])", rewardsToken);
        timeJump(60 * 60 * 24 * 7);
        dealFXS(address(accumulator), rewardsAmount[0]);
        notifyExtraReward(
            LOCAL_DEPLOYER,
            address(accumulator),
            rewardsToken,
            address(liquidityGauge),
            rewardsAmount,
            notityExtraRewardCallData
        );
    }

    function testBaseAccumulator05DepositToken() public {
        uint256 amount = 1e18;
        bytes memory depositTokenCallData = abi.encodeWithSignature("depositToken(address,uint256)", token, 1e18);
        dealFXS(LOCAL_DEPLOYER, amount);
        depositToken(LOCAL_DEPLOYER, address(accumulator), token, amount, depositTokenCallData);
    }

    function testBaseAccumulator06SetGauge() public {
        bytes memory setGaugeCallData = abi.encodeWithSignature("setGauge(address)", address(0xA));
        bytes memory gaugeCallData = abi.encodeWithSignature("gauge()");
        setter(
            LOCAL_DEPLOYER, address(accumulator), address(accumulator), address(0xA), setGaugeCallData, gaugeCallData
        );
    }

    function testBaseAccumulator07SetSdtDistributor() public {
        bytes memory setSDTDistributorCallData = abi.encodeWithSignature("setSdtDistributor(address)", address(0xA));
        bytes memory sdtDistributorCallData = abi.encodeWithSignature("sdtDistributor()");
        setter(
            LOCAL_DEPLOYER,
            address(accumulator),
            address(accumulator),
            address(0xA),
            setSDTDistributorCallData,
            sdtDistributorCallData
        );
    }

    function testBaseAccumulator08SetLocker() public {
        bytes memory setLockerCallData = abi.encodeWithSignature("setLocker(address)", address(0xA));
        bytes memory lockerCallData = abi.encodeWithSignature("locker()");
        setter(
            LOCAL_DEPLOYER, address(accumulator), address(accumulator), address(0xA), setLockerCallData, lockerCallData
        );
    }

    function testBaseAccumulator09SetTokenReward() public {
        bytes memory setTokenRewardCallData = abi.encodeWithSignature("setTokenReward(address)", address(0xA));
        bytes memory tokenRewardCallData = abi.encodeWithSignature("tokenReward()");
        setter(
            LOCAL_DEPLOYER,
            address(accumulator),
            address(accumulator),
            address(0xA),
            setTokenRewardCallData,
            tokenRewardCallData
        );
    }

    function testBaseAccumulator10SetClaimerFee() public {
        bytes memory setClaimerFeeCallData = abi.encodeWithSignature("setClaimerFee(uint256)", 10);
        bytes memory claimerFeeCallData = abi.encodeWithSignature("claimerFee()");
        setter(
            LOCAL_DEPLOYER, address(accumulator), address(accumulator), 10, setClaimerFeeCallData, claimerFeeCallData
        );
    }

    function testBaseAccumulator09SetGovernance() public {
        bytes memory setGovernanceCallData = abi.encodeWithSignature("setGovernance(address)", address(0xA));
        bytes memory governanceCallData = abi.encodeWithSignature("governance()");
        setter(
            LOCAL_DEPLOYER,
            address(accumulator),
            address(accumulator),
            address(0xA),
            setGovernanceCallData,
            governanceCallData
        );
    }

    function testBaseAccumulator12RescueToken() public {
        uint256 amount = 1e18;
        bytes memory rescueTokenCallData =
            abi.encodeWithSignature("rescueERC20(address,uint256,address)", token, 1e18, address(0xA));
        dealFXS(address(accumulator), amount);
        rescueToken(LOCAL_DEPLOYER, address(accumulator), token, address(0xA), amount, rescueTokenCallData);
    }

    function testBaseAccumulator13Revert() public {
        uint8 i = 5;
        // callData
        bytes[] memory listCallData = new bytes[](i);
        listCallData[0] = abi.encodeWithSignature("notifyExtraReward(address,uint256)", token, 10);
        listCallData[1] = abi.encodeWithSignature("notifyExtraReward(address,uint256)", token, 10);
        listCallData[2] = abi.encodeWithSignature("depositToken(address,uint256)", token, 0);
        listCallData[3] = abi.encodeWithSignature("setGauge(address)", address(0));
        listCallData[4] = abi.encodeWithSignature("rescueERC20(address,uint256,address)", token, 10, address(0));

        // Revert reasons
        bytes[] memory listRevertReason = new bytes[](i);
        listRevertReason[0] = bytes("!gov");
        listRevertReason[1] = bytes("amount not enough");
        listRevertReason[2] = bytes("set an amount > 0");
        listRevertReason[3] = bytes("can't be zero address");
        listRevertReason[4] = bytes("can't be zero address");

        // Caller
        address[] memory listCaller = new address[](i);
        listCaller[0] = address(0xB0B);
        listCaller[1] = LOCAL_DEPLOYER;
        listCaller[2] = LOCAL_DEPLOYER;
        listCaller[3] = LOCAL_DEPLOYER;
        listCaller[4] = LOCAL_DEPLOYER;

        reverter(listCaller, address(accumulator), listCallData, listRevertReason);
    }

    ////////////////////////////////////////////////////////////////
    /// --- ACCUMULATOR
    ///////////////////////////////////////////////////////////////

    function testAccumulator01ClaimAndNotify() public {
        testLocker01createLock();
        bytes[] memory listCallData = new bytes[](1);
        address rewardsReceiver = address(liquidityGauge);
        listCallData[0] = abi.encodeWithSignature("claimAndNotify(uint256)", rewardsAmount[0] / 1e14);
        dealFXS(yieldDistributor, rewardsAmount[0]);
        timeJump(2 weeks);
        claimRewardAndNotify(
            LOCAL_DEPLOYER, address(accumulator), rewardsToken, rewardsReceiver, address(liquidityGauge), listCallData
        );
    }

    function testAccumulator02ClaimAndNotifyAll() public {
        testLocker01createLock();
        bytes[] memory listCallData = new bytes[](1);
        address rewardsReceiver = address(liquidityGauge);
        listCallData[0] = abi.encodeWithSignature("claimAndNotifyAll()");
        dealFXS(yieldDistributor, rewardsAmount[0]);
        timeJump(2 weeks);
        claimRewardAndNotify(
            LOCAL_DEPLOYER, address(accumulator), rewardsToken, rewardsReceiver, address(liquidityGauge), listCallData
        );
    }

    ////////////////////////////////////////////////////////////////
    /// --- SDTOKEN
    ///////////////////////////////////////////////////////////////
    function testSdToken01Mint() public {
        address to = ALICE;
        uint256 mintAmount = 1e18;
        bytes memory mintCallData = abi.encodeWithSignature("mint(address,uint256)", to, mintAmount);
        mint(address(depositor), address(_sdToken), to, mintAmount, mintCallData);
    }

    function testSdToken02Burn() public {
        testSdToken01Mint();
        address from = ALICE;
        uint256 burnAmount = 1e18;
        bytes memory burnCallData = abi.encodeWithSignature("burn(address,uint256)", from, burnAmount);
        burn(address(depositor), address(_sdToken), from, burnAmount, burnCallData);
    }

    function testSdToken03SetOperator() public {
        bytes memory setOperatorCallData = abi.encodeWithSignature("setOperator(address)", address(0xA));
        bytes memory operatorCallData = abi.encodeWithSignature("operator()");
        setter(
            address(depositor),
            address(_sdToken),
            address(_sdToken),
            address(0xA),
            setOperatorCallData,
            operatorCallData
        );
    }

    function testSdToken04Revert() public {
        uint8 i = 5;
        // callData
        bytes[] memory listCallData = new bytes[](i);
        listCallData[0] = abi.encodeWithSignature("setOperator(address)", address(0x1));

        // Revert reasons
        bytes[] memory listRevertReason = new bytes[](i);
        listRevertReason[0] = bytes("!authorized");

        // Caller
        address[] memory listCaller = new address[](i);
        listCaller[0] = address(0xB0B);

        reverter(listCaller, address(_sdToken), listCallData, listRevertReason);
    }

    ////////////////////////////////////////////////////////////////
    /// --- HELPERS
    ///////////////////////////////////////////////////////////////
    /// @notice using deal for giving FXS token doesn't work
    function dealFXS(address receiver, uint256 amount) public {
        vm.prank(AddressBook.VE_FXS);
        IERC20(AddressBook.FXS).transfer(receiver, amount);
    }
}
