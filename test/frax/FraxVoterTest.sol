// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "forge-std/Test.sol";
import "contracts/dao/voters/FraxVoter.sol";
import "contracts/interfaces/IGaugeController.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

contract FraxVoterTest is Test {
    FraxVoter fraxVoter;
    FraxStrategy fraxStrategyContract;
    address public constant fxsLocker = 0xCd3a267DE09196C48bbB1d9e842D7D7645cE448f;
    address public constant fxsGaugeController = 0x3669C421b77340B2979d1A00a792CC2ee0FcE737;
    address public constant fraxStrategy = 0xf285Dec3217E779353350443fC276c07D05917c3;
    address public constant FXS = 0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0;
    address public constant GOVERNANCE = 0x0dE5199779b43E13B3Bec21e91117E18736BC1A8;

    function setUp() public {
        uint256 forkId = vm.createFork(vm.rpcUrl("mainnet"), 15568813);
        vm.selectFork(forkId);
        fraxVoter = new FraxVoter();
        fraxStrategyContract = FraxStrategy(fraxStrategy);
        vm.prank(GOVERNANCE);
        fraxStrategyContract.setGovernance(address(fraxVoter));
    }

    function testBribeClaim() public {
        bytes memory executeData = abi.encodeWithSignature(
            "execute(address,uint256,bytes)",
            fxsLocker,
            0,
            bytes(
                hex"b61d27f60000000000000000000000005d135c1a7604bf0b78018a21ba722e9a06e6d09600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000022420ce64de000000000000000000000000cd3a267de09196c48bbb1d9e842d7d7645ce448f0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000003432b6a60d23ca0dfca7761b7ab56459d9c964d00000000000000000000000000000000000000000000000000000000000000023000000000000000000000000000000000000000000000007a53eeaaf098547d5000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000086597dbfa1adb8222f3a06e1942a66c8e744ff1421a987aac51522ea13e98df151ff2f4a9c3a98866e76059b552c1efcf8647d88cffdf0f716302b00cc41c186076df4c02c6d3c8492b9f06359a32566e48883fecd4988ba4281da2b0bc57d836621b028e3e0184574a109172835ed6adc784e70e513f31bde905d931acec0d32066717fec8288ea85432d701c67964c62faeb245dfe00aa18c6ec7e5b7c0d3904b8933423542cc968098fe24a0f04b88b5e0c7c944b6d1a243a0abc56962f8731cfb2888cb8cf47798b8e143e45e18ff2f127e308f040e043f4f12c99815e17a56554cc0fff2a41fde88aa7f741addec22f1897f5d9a1ff3100101252fa3983400000000000000000000000000000000000000000000000000000000"
            )
        );
        fraxVoter.executeAndTransfer(fraxStrategy, 0, executeData, FXS, address(this));
        uint256 fxsBalance = IERC20(FXS).balanceOf(address(this));
        assert(fxsBalance > 0);
    }

    function testVoting() public {
        IGaugeController.VotedSlope memory vote =
            IGaugeController(fxsGaugeController).vote_user_slopes(fxsLocker, 0x698137C473bc1F0Ea9b85adE45Caf64ef2DF48d6);
        address[] memory gauges = new address[](1);
        uint256[] memory votes = new uint256[](1);
        gauges[0] = 0x698137C473bc1F0Ea9b85adE45Caf64ef2DF48d6;
        votes[0] = 4000;

        fraxVoter.voteGauges(gauges, votes);

        IGaugeController.VotedSlope memory afterVoted =
            IGaugeController(fxsGaugeController).vote_user_slopes(fxsLocker, 0x698137C473bc1F0Ea9b85adE45Caf64ef2DF48d6);
        assertEq(vote.power, 0);
        assertEq(afterVoted.power, 4000);
    }
}
