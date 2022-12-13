// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ICurvePool.sol";
import "../interfaces/ICurveZapper.sol";
import "../interfaces/IFeeDistributor.sol";
import "../interfaces/ISdFraxVault.sol";

contract VeSDTFeeCurveProxyV2 is Ownable {
	using SafeERC20 for IERC20;

    struct CurveExchangeData {
        address pool;
        uint256 fromIndex;
        uint256 toIndex;
    }

	address public constant CRV = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    address public constant CURVE_ZAPPER = 0x5De4EF4879F4fe3bBADF2227D2aC5d0E2D76C895;
	address public constant FEE_D = 0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92;
	address public constant FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;
	address public constant FRAX_3CRV = 0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B;
	address public constant SD_FRAX_3CRV = 0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7;
	
	uint256 public constant BASE_FEE = 10000;
    uint256 public claimerFee = 100;
    CurveExchangeData public curveExchangeData;

	constructor(
        CurveExchangeData memory _curveExchangeData
    ) {

		curveExchangeData = _curveExchangeData;
        require(curveExchangeData.pool != address(0), "zero address");
        IERC20(CRV).safeApprove(CURVE_ZAPPER, type(uint256).max);
	}

    /// @notice function to send reward
	function sendRewards() external {
		uint256 crvBalance = IERC20(CRV).balanceOf(address(this));
        if (crvBalance != 0) {
            // swap CRV <-> FRAX on curve
            _swapOnCurve(crvBalance);
		    uint256 fraxBalance = IERC20(FRAX).balanceOf(address(this));
		    uint256 claimerPart = (fraxBalance * claimerFee) / BASE_FEE;
		    IERC20(FRAX).transfer(msg.sender, claimerPart);
		    IERC20(FRAX).approve(FRAX_3CRV, fraxBalance - claimerPart);
		    ICurvePool(FRAX_3CRV).add_liquidity([fraxBalance - claimerPart, 0], 0);
		    uint256 frax3CrvBalance = IERC20(FRAX_3CRV).balanceOf(address(this));
		    IERC20(FRAX_3CRV).approve(SD_FRAX_3CRV, fraxBalance - claimerPart);
		    ISdFraxVault(SD_FRAX_3CRV).deposit(frax3CrvBalance);
		    IERC20(SD_FRAX_3CRV).transfer(FEE_D, IERC20(SD_FRAX_3CRV).balanceOf(address(this)));
        } 
	}

    /// @notice internal function to swap CRV to FRAX on curve
	/// @param _amount amount to swap
    function _swapOnCurve(uint256 _amount) internal {
        ICurveZapper(CURVE_ZAPPER).exchange(
            curveExchangeData.pool, 
            curveExchangeData.fromIndex,
            curveExchangeData.toIndex,
            _amount,
            0
        );
    }

    /// @notice function to calculate the amount reserved for keepers
	function claimableByKeeper() public view returns (uint256) {
		uint256 crvBalance = IERC20(CRV).balanceOf(address(this));
		if (crvBalance == 0) {
			return 0;
		}

        uint256 fraxAmount = ICurveZapper(CURVE_ZAPPER).get_dy(
            curveExchangeData.pool,
            curveExchangeData.fromIndex, 
            curveExchangeData.toIndex, 
            crvBalance
        );
		return (fraxAmount * claimerFee) / BASE_FEE;
	}

    /// @notice function to set a new claimer fee 
	/// @param _claimerFee claimer fee
	function setClaimerFee(uint256 _claimerFee) external onlyOwner {
        require(_claimerFee <= BASE_FEE, ">100%");
		claimerFee = _claimerFee;
	}

    /// @notice function to set curve exchange data
	/// @param _exchangeData exchange data (pool, fromIndex, toIndex)
    function setCurveExchangeData(CurveExchangeData calldata _exchangeData) external onlyOwner {
        address pool = _exchangeData.pool;
        require(pool != address(0), "zero address");
        curveExchangeData = _exchangeData;
    }
    
    /// @notice function to recover any ERC20 and send them to the owner
	/// @param _token token address
	/// @param _amount amount to recover
	function recoverERC20(address _token, uint256 _amount) external onlyOwner {
		IERC20(_token).transfer(owner(), _amount);
	}
}