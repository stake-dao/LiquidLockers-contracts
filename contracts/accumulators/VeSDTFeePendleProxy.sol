// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "openzeppelin-contracts/access/Ownable.sol";
import "openzeppelin-contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ISdFraxVault.sol";
import "../interfaces/ICurvePool.sol";
import "../interfaces/IFraxSwapRouter.sol";

contract VeSDTFeePendleProxy is Ownable {
    using SafeERC20 for IERC20;

    error WRONG_SWAP_PATH();
    error FEE_TOO_HIGH();

    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant FEE_D = 0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92;
    address public constant FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;
    address public constant FRAX_3CRV = 0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B;
    address public constant SD_FRAX_3CRV = 0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7;
    address public constant FRAX_SWAP_ROUTER = 0xC14d550632db8592D1243Edc8B95b0Ad06703867;

    uint256 public constant BASE_FEE = 10_000;
    uint256 public claimerFee = 100;
    address[] public wethToFraxPath;

    constructor(address[] memory _wethToFraxPath) {
        wethToFraxPath = _wethToFraxPath;
        IERC20(WETH).safeApprove(FRAX_SWAP_ROUTER, type(uint256).max);
    }

    /// @notice function to send reward
    function sendRewards() external {
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        if (wethBalance != 0) {
            // swap WETH <-> FRAX on frax swap
            _swapOnFrax(wethBalance);
            uint256 fraxBalance = IERC20(FRAX).balanceOf(address(this));
            uint256 claimerPart = (fraxBalance * claimerFee) / BASE_FEE;
            // send FRAX to the claimer
            IERC20(FRAX).transfer(msg.sender, claimerPart);
            IERC20(FRAX).approve(FRAX_3CRV, fraxBalance - claimerPart);
            // provide liquidity on frax3crv pool on curve
            ICurvePool(FRAX_3CRV).add_liquidity([fraxBalance - claimerPart, 0], 0);
            uint256 frax3CrvBalance = IERC20(FRAX_3CRV).balanceOf(address(this));
            IERC20(FRAX_3CRV).approve(SD_FRAX_3CRV, fraxBalance - claimerPart);
            // deposit curve LP on stake dao
            ISdFraxVault(SD_FRAX_3CRV).deposit(frax3CrvBalance);
            // send all sdfrax3crv to the veSDT fee distributor 
            IERC20(SD_FRAX_3CRV).transfer(FEE_D, IERC20(SD_FRAX_3CRV).balanceOf(address(this)));
        }
    }

    /// @notice internal function to swap Weth to Frax on frax swap
    /// @param _amount amount to swap
    function _swapOnFrax(uint256 _amount) internal {
        // swap weth to frax
        IFraxSwapRouter(FRAX_SWAP_ROUTER).swapExactTokensForTokens(
            _amount, 
            0, 
            wethToFraxPath, 
            address(this), 
            block.timestamp + 1800
        );
    }

    /// @notice function to calculate the amount reserved for keepers
    function claimableByKeeper() public view returns (uint256) {
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        if (wethBalance == 0) {
            return 0;
        }
        uint256[] memory amounts = IFraxSwapRouter(FRAX_SWAP_ROUTER).getAmountsOut(wethBalance, wethToFraxPath);
        return (amounts[wethToFraxPath.length - 1] * claimerFee) / BASE_FEE;
    }

    /// @notice function to set a new claimer fee
    /// @param _claimerFee claimer fee
    function setClaimerFee(uint256 _claimerFee) external onlyOwner {
        if (_claimerFee > BASE_FEE) revert FEE_TOO_HIGH();
        claimerFee = _claimerFee;
    }

    /// @notice function to set the fraxswap Weth <-> Frax swap path  (Weth <-> .. <-> Frax)
    /// @param _path swap path
    function setwethToFraxPath(address[] calldata _path) external onlyOwner {
        if (_path[0] != WETH) revert WRONG_SWAP_PATH();
        if (_path[_path.length - 1] != FRAX) revert WRONG_SWAP_PATH();
        wethToFraxPath = _path;
    }

    /// @notice function to recover any ERC20 and send them to the owner
    /// @param _token token address
    /// @param _amount amount to recover
    function recoverERC20(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(owner(), _amount);
    }
}