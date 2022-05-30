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
const CURVE_STRATEGY = "0x20F1d4Fed24073a9b9d388AfA2735Ac91f079ED6";
const CURVE_PROTOCOL_VOTER = "0xE478de485ad2fe566d49342Cbd03E49ed7DB3356";
const CURVE_LOCKER = "0x52f541764E6e90eeBc5c21Ff570De0e2D63766B6";
const CURVE_GAUGE_CONTROLLER = "0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB";
describe("Curve Voter", function () {
  let governance: JsonRpcSigner;
  let curveStrategy: Contract;
  let curveGaugeController: Contract;
  let curveVoter: Contract;
  let curveProtocolVoter: Contract;
  let localDeployer: SignerWithAddress, dummyMs: SignerWithAddress;
  before(async function () {
    [localDeployer, dummyMs] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [GOVERNANCE]
    });

    const CurveVoter = await ethers.getContractFactory("CurveVoter");

    governance = ethers.provider.getSigner(GOVERNANCE);

    await network.provider.send("hardhat_setBalance", [GOVERNANCE, ETH_100]);

    curveStrategy = await ethers.getContractAt("CurveStrategy", CURVE_STRATEGY);
    curveProtocolVoter = await ethers.getContractAt(CURVEVOTERABI, CURVE_PROTOCOL_VOTER);
    curveVoter = await CurveVoter.deploy();
    curveGaugeController = await ethers.getContractAt("GaugeController", CURVE_GAUGE_CONTROLLER);
    curveStrategy.connect(governance).setGovernance(curveVoter.address);
  });

  describe("Curve Voter tests", function () {
    it("it should vote for the proposal", async () => {
      await curveVoter.vote(185, true);
      const vote = await curveProtocolVoter.getVoterState(185, CURVE_LOCKER);
      expect(vote).to.be.equal(1);
    });
    it("it should vote for gauge weights", async () => {
      const alUSDAllocationBefore = await curveGaugeController.vote_user_slopes(
        CURVE_LOCKER,
        "0x9582C4ADACB3BCE56Fea3e590F05c3ca2fb9C477"
      );
      await curveVoter.voteGauges(
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
      expect(alUSDAllocationBefore[1]).to.be.equal(4607);
      expect(alUSDAllocationAfter[1]).to.be.equal(3810);
    });
  });
});
