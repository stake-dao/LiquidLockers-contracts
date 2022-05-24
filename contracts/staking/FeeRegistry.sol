// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;



/*
Module that just holds fee information. This allow various contracts to grab required information without
needing a reference to the current "booster" or management contract
*/
contract FeeRegistry{

    address public owner;

    //uint256 public cvxfxsIncentive = 1000;
    //uint256 public cvxIncentive = 700;
    //uint256 public platformIncentive = 0;

    /* StakeDAO */ 
    uint256 public multisigPart = 300;
    uint256 public accumulatorPart = 300;
    uint256 public veSDTPart = 400;
    uint256 public totalFees = 1000;
    /* ======== */
    address public feeDeposit;
    uint256 public constant maxFees = 2000;
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public multiSig = address(0x1CC16bEdaaCD15848bcA5eB80188e0931bC59fB2);
    address public accumulator = address(0x1CC16bEdaaCD15848bcA5eB80188e0931bC59fB2);
    address public veSDTFeeProxy;


    mapping(address => address) public redirectDepositMap;

    constructor(address _veSDTFeeProxy) {
        owner = msg.sender;
        veSDTFeeProxy = _veSDTFeeProxy;
    }

    /////// Owner Section /////////

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }

    //set platform fees
    function setFees(uint256 _multi, uint256 _accumulator, uint256 _veSDT) external onlyOwner{
        totalFees = _multi + _accumulator + _veSDT;
        require(totalFees <= maxFees, "fees over");

        multisigPart = _multi;
        accumulatorPart = _accumulator;
        veSDTPart = _veSDT;
    }

    function setDepositAddress(address _deposit) external onlyOwner{
        require(_deposit != address(0),"zero");
        feeDeposit = _deposit;
    }

    function setRedirectDepositAddress(address _from, address _deposit) external onlyOwner{
        redirectDepositMap[_from] = _deposit;
    }

    function setOwner(address _owner) external onlyOwner{
        owner = _owner;
    }

    function getFeeDepositor(address _from) external view returns(address){
        //check if in redirect map
        if(redirectDepositMap[_from] != address(0)){
            return redirectDepositMap[_from];
        }

        //return default
        return feeDeposit;
    }

}