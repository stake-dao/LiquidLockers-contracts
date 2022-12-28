// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

// Base Tests
import "./baseTest/Base.t.sol";
import "./fixtures/LibString.sol";

import "contracts/dao/voters/CurveVoterV2.sol";
import "contracts/strategies/curve/CurveStrategy.sol";

import "contracts/interfaces/IGaugeController.sol";
import "contracts/interfaces/ISmartWalletChecker.sol";

interface ICurveProtocolVoter {
    enum VoterState {
        Absent,
        Yea,
        Nay,
        Even
    }

    function getVote(uint256 voteId)
        external
        view
        returns (
            bool open,
            bool executed,
            uint64 startDate,
            uint64 snapshotBlock,
            uint64 supportRequired,
            uint64 minAcceptQuorum,
            uint256 yea,
            uint256 nay,
            uint256 votingPower,
            bytes memory script
        );

    function votesLength() external view returns (uint256);

    function newVote(bytes memory _executionScript, string memory _metadata) external;

    function getVoterState(uint256 voteId, address _user) external view returns (VoterState);
}

contract CurveVoterTest is BaseTest {
    address public constant CURVE_STRATEGY = 0x20F1d4Fed24073a9b9d388AfA2735Ac91f079ED6;
    address public constant crvLocker = 0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6;
    address public constant LOCAL_DEPLOYER = address(0xDE);
    address public constant ALICE = address(0xAA);

    uint256 public constant AMOUNT_TO__LOCK = 30_000_000e18;

    CurveVoterV2 public voter;
    CurveStrategy public strategy;

    ICurveProtocolVoter public protocol = ICurveProtocolVoter(AddressBook.CURVE_PROTOCOL_VOTER);
    IGaugeController public gc = IGaugeController(AddressBook.CURVE_PROTOCOL_GC);

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"), 16124919);
        vm.selectFork(forkId);
        strategy = CurveStrategy(CURVE_STRATEGY);
        voter = new CurveVoterV2();
        vm.prank(strategy.governance());
        strategy.setGovernance(address(voter));
    }

    function testVoteForProposal() public {
        vm.prank(0xAA7A9d80971E58641442774C373C94AaFee87d66);
        protocol.newVote("0x00", "");
        timeJump(1 days);
        uint256 voteId = protocol.votesLength() - 1;
        vm.prank(voter.governance());
        voter.vote(voteId, true, AddressBook.CURVE_PROTOCOL_VOTER);
        assertEq(abi.encode(protocol.getVoterState(voteId, crvLocker)), abi.encode(ICurveProtocolVoter.VoterState.Yea));
    }

    function testVoteForGaugeWeight() public {
        timeJump(15 days);
        vm.prank(strategy.governance());
        strategy.setGovernance(address(voter));
        IGaugeController.VotedSlope memory allocBefore =
            gc.vote_user_slopes(crvLocker, 0x9582C4ADACB3BCE56Fea3e590F05c3ca2fb9C477);
        address[] memory addresses = new address[](1);
        uint256[] memory weights = new uint256[](1);
        addresses[0] = 0x9582C4ADACB3BCE56Fea3e590F05c3ca2fb9C477;
        weights[0] = 300;

        vm.prank(voter.governance());
        voter.voteGauges(addresses, weights);

        IGaugeController.VotedSlope memory allocAfter =
            gc.vote_user_slopes(crvLocker, 0x9582C4ADACB3BCE56Fea3e590F05c3ca2fb9C477);
        assertGt(allocBefore.power, 0);
        assertEq(allocAfter.power, 300);
    }

    /*
    function testClaimBribes() public {
    address to = 0x20F1d4Fed24073a9b9d388AfA2735Ac91f079ED6;
    address token = 0x090185f2135308BaD17527004364eBcC2D37e5F6; // SPELL token from MIM
    bytes
    memory data = "0xb61d27f600000000000000000000000052f541764e6e90eebc5c21ff570de0e2d63766b6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000104b61d27f60000000000000000000000007893bbb46613d7a4fbcc31dab4c9b823ffee1026000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000064840f30d000000000000000000000000052f541764e6e90eebc5c21ff570de0e2d63766b6000000000000000000000000d8b712d29381748db89c36bca0138d7c75866ddf000000000000000000000000090185f2135308bad17527004364ebcc2d37e5f60000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    vm.prank(voter.governance());
    voter.executeAndTransfer(to, 0, data, token, LOCAL_DEPLOYER);
    }*/
}
// ybribes 		0x840f30d000000000000000000000000052f541764e6e90eebc5c21ff570de0e2d63766b6000000000000000000000000d8b712d29381748db89c36bca0138d7c75866ddf000000000000000000000000090185f2135308bad17527004364ebcc2d37e5f6
// crvLocker 	0xb61d27f60000000000000000000000007893bbb46613d7a4fbcc31dab4c9b823ffee1026000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000064840f30d000000000000000000000000052f541764e6e90eebc5c21ff570de0e2d63766b6000000000000000000000000d8b712d29381748db89c36bca0138d7c75866ddf000000000000000000000000090185f2135308bad17527004364ebcc2d37e5f600000000000000000000000000000000000000000000000000000000
// strategie	0xb61d27f600000000000000000000000052f541764e6e90eebc5c21ff570de0e2d63766b6000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000104b61d27f60000000000000000000000007893bbb46613d7a4fbcc31dab4c9b823ffee1026000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000064840f30d000000000000000000000000052f541764e6e90eebc5c21ff570de0e2d63766b6000000000000000000000000d8b712d29381748db89c36bca0138d7c75866ddf000000000000000000000000090185f2135308bad17527004364ebcc2d37e5f60000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
