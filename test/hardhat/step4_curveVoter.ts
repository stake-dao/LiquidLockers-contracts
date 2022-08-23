import { ethers, network } from "hardhat";
import { expect } from "chai";

import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";
import MASTERCHEFABI from "./fixtures/Masterchef.json";
import ERC20ABI from "./fixtures/ERC20.json";
import CURVEVOTERABI from "./fixtures/CurveVoter.json";
import WalletCheckerABI from "./fixtures/WalletChecker.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const ONE_YEAR_IN_SECONDS = 24 * 3600 * 365;

const ETH_100 = BigNumber.from(10).mul(BigNumber.from(10).pow(18)).toHexString();

const GOVERNANCE = "0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063";
const STRATEGY_GOVERNANCE = "0x102a4ed45395e065390173e900d1a76a589e0237";
const CURVE_STRATEGY = "0x20F1d4Fed24073a9b9d388AfA2735Ac91f079ED6";
const CURVE_PROTOCOL_VOTER = "0xE478de485ad2fe566d49342Cbd03E49ed7DB3356";
const CURVE_LOCKER = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";
const CURVE_GAUGE_CONTROLLER = "0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB";
const CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52";
describe("Curve Voter", function () {
  let governance: JsonRpcSigner;
  let strategyGovernance: JsonRpcSigner;
  let curveStrategy: Contract;
  let curveGaugeController: Contract;
  let curveVoter: Contract;
  let crv: Contract;
  let curveProtocolVoter: Contract;
  let localDeployer: SignerWithAddress, dummyMs: SignerWithAddress;
  before(async function () {
    [localDeployer, dummyMs] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [GOVERNANCE]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [STRATEGY_GOVERNANCE]
    });

    const CurveVoter = await ethers.getContractFactory("CurveVoterV2");

    governance = ethers.provider.getSigner(GOVERNANCE);
    strategyGovernance = ethers.provider.getSigner(STRATEGY_GOVERNANCE);
    await network.provider.send("hardhat_setBalance", [GOVERNANCE, ETH_100]);
    await network.provider.send("hardhat_setBalance", [STRATEGY_GOVERNANCE, ETH_100]);
    curveStrategy = await ethers.getContractAt("CurveStrategy", CURVE_STRATEGY);
    curveProtocolVoter = await ethers.getContractAt(CURVEVOTERABI, CURVE_PROTOCOL_VOTER);
    crv = await ethers.getContractAt("ERC20", CRV);
    curveVoter = await CurveVoter.deploy();
    curveGaugeController = await ethers.getContractAt("GaugeController", CURVE_GAUGE_CONTROLLER);
    curveStrategy.connect(strategyGovernance).setGovernance(curveVoter.address);
  });

  it("it should vote for the proposal", async () => {
    await curveVoter.connect(governance).vote(189, true, CURVE_PROTOCOL_VOTER);
    const vote = await curveProtocolVoter.getVoterState(189, CURVE_LOCKER);
    expect(vote).to.be.equal(1);
  });
  it("it should vote for gauge weights", async () => {
    const alUSDAllocationBefore = await curveGaugeController.vote_user_slopes(
      CURVE_LOCKER,
      "0x9582C4ADACB3BCE56Fea3e590F05c3ca2fb9C477"
    );
    await curveVoter
      .connect(governance)
      .voteGauges(
        [
          "0xd4B22fEdcA85E684919955061fDf353b9d38389b",
          "0x9582C4ADACB3BCE56Fea3e590F05c3ca2fb9C477",
          "0x03fFC218C7A9306D21193565CbDc4378952faA8c",
          "0x1cEBdB0856dd985fAe9b8fEa2262469360B8a3a6",
          "0x60355587a8D4aa67c2E64060Ab36e566B9bCC000",
          "0x663FC22e92f26C377Ddf3C859b560C4732ee639a",
          "0x12dCD9E8D1577b5E4F066d8e7D404404Ef045342"
        ],
        [0, 3810, 804, 10, 53, 206, 4880]
      );
    const alUSDAllocationAfter = await curveGaugeController.vote_user_slopes(
      CURVE_LOCKER,
      "0x9582C4ADACB3BCE56Fea3e590F05c3ca2fb9C477"
    );
    expect(alUSDAllocationBefore[1]).to.be.equal(2585);
    expect(alUSDAllocationAfter[1]).to.be.equal(3810);
  });
  it("it should claim the bribes and send to the given address", async () => {
    const to = "0x20F1d4Fed24073a9b9d388AfA2735Ac91f079ED6";
    const data =
      "0xb61d27f600000000000000000000000052f541764e6e90eebc5c21ff570de0e2d63766b60000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e4b61d27f60000000000000000000000007893bbb46613d7a4fbcc31dab4c9b823ffee1026000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044750d49260000000000000000000000001cebdb0856dd985fae9b8fea2262469360b8a3a6000000000000000000000000d533a949740bb3306d119cc777fa900ba034cd520000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const crvBalanceBefore = await crv.balanceOf(localDeployer.address);
    await curveVoter.connect(governance).executeAndTransfer(to, 0, data, CRV, localDeployer.address);
    const crvBalanceAfter = await crv.balanceOf(localDeployer.address);
    expect(crvBalanceBefore).to.be.eq(0);
    expect(crvBalanceAfter).to.be.gt(crvBalanceBefore);
  });
});
