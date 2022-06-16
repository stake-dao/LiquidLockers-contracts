// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

/*
Module that just holds fee information. This allow various contracts to grab required information without
needing a reference to the current "booster" or management contract
*/
contract FeeRegistry{

    address public owner;

    /* StakeDAO */ 
    
    uint256 public totalFees = 900;
    uint256 public veSDTPart = 300;
    uint256 public multisigPart = 300;
    uint256 public accumulatorPart = 300;
    /* ======== */
    uint256 public constant maxFees = 2000;
    uint256 public constant FEE_DENOMINATOR = 10000; 

    address public multiSig = address(0xF930EBBd05eF8b25B1797b9b2109DDC9B0d43063);
    address public accumulator = address(0x1CC16bEdaaCD15848bcA5eB80188e0931bC59fB2);
    address public veSDTFeeProxy; // 

    constructor(address _veSDTFeeProxy) {
        owner = msg.sender;
        veSDTFeeProxy = _veSDTFeeProxy;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }

    function setOwner(address _owner) external onlyOwner{
        owner = _owner;
    }

    //set platform fees
    function setFees(uint256 _multi, uint256 _accumulator, uint256 _veSDT) external onlyOwner{
        totalFees = _multi + _accumulator + _veSDT;
        require(totalFees <= maxFees, "fees over");

        multisigPart = _multi;
        accumulatorPart = _accumulator;
        veSDTPart = _veSDT;
    }

    function setMultisig(address _multi) external onlyOwner{
        require(_multi!=address(0),"!address(0)");
        multiSig = _multi;
    }

    function setAccumulator(address _accumulator) external onlyOwner{
        require(_accumulator!=address(0),"!address(0)");
        accumulator = _accumulator;
    }

    function setVeSDTFeeProxy(address _feeProxy) external onlyOwner{
        require(_feeProxy!=address(0),"!address(0)");
        veSDTFeeProxy = _feeProxy;
    }
}