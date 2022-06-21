// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import "../interfaces/IFeeDistributor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ICurvePool.sol";
import "../interfaces/IUniswapRouter.sol";
import "../interfaces/ISdFraxVault.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract veSDTFeeFraxProxy is Ownable {
	using SafeERC20 for IERC20;
	address public constant sdFrax3Crv = 0x5af15DA84A4a6EDf2d9FA6720De921E1026E37b7;
	address public constant frax3Crv = 0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B;
	address public constant fxs = 0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0;
	address public constant feeD = 0x29f3dd38dB24d3935CF1bf841e6b2B461A3E5D92;
	address public constant frax = 0x853d955aCEf822Db058eb8505911ED77F175b99e;
	address public constant sushiRouter = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
	uint256 public claimerFee = 100;
	uint256 public constant BASE_FEE = 10000;
	uint256 public maxSlippage = 100;
	address[] public fxsToFraxPath;

	constructor(address[] memory _fxsToFraxPath) {
		fxsToFraxPath = _fxsToFraxPath;
		IERC20(fxs).safeApprove(sushiRouter, type(uint256).max);
	}

	function sendRewards() external {
		uint256 fxsBalance = IERC20(fxs).balanceOf(address(this));
		_swapOnSushi(fxsBalance);
		uint256 fraxBalance = IERC20(frax).balanceOf(address(this));
		uint256 claimerPart = (fraxBalance * claimerFee) / BASE_FEE;
		IERC20(frax).transfer(msg.sender, claimerPart);
		IERC20(frax).approve(frax3Crv, fraxBalance - claimerPart);
		ICurvePool(frax3Crv).add_liquidity([fraxBalance - claimerPart, 0], 0);
		uint256 frax3CrvBalance = IERC20(frax3Crv).balanceOf(address(this));
		IERC20(frax3Crv).approve(sdFrax3Crv, fraxBalance - claimerPart);
		ISdFraxVault(sdFrax3Crv).deposit(frax3CrvBalance);
		IERC20(sdFrax3Crv).transfer(feeD, IERC20(sdFrax3Crv).balanceOf(address(this)));
	}

	// slippageCRV = 100 for 1% max slippage
	function _swapOnSushi(uint256 _amount) internal returns (uint256) {
		uint256[] memory amounts = IUniswapRouter(sushiRouter).getAmountsOut(_amount, fxsToFraxPath);

		uint256 minAmount = (amounts[fxsToFraxPath.length - 1] * (10000 - maxSlippage)) / (10000);

		uint256[] memory outputs = IUniswapRouter(sushiRouter).swapExactTokensForTokens(
			_amount,
			minAmount,
			fxsToFraxPath,
			address(this),
			block.timestamp + 1800
		);

		return outputs[1];
	}

	function claimableByKeeper() public view returns (uint256) {
		uint256 fxsBalance = IERC20(fxs).balanceOf(address(this));
		uint256[] memory amounts = IUniswapRouter(sushiRouter).getAmountsOut(fxsBalance, fxsToFraxPath);
		uint256 minAmount = (amounts[fxsToFraxPath.length - 1] * (10000 - maxSlippage)) / (10000);
		return (minAmount * claimerFee) / BASE_FEE;
	}

	function setSlippage(uint256 newSlippage) external onlyOwner {
		maxSlippage = newSlippage;
	}

	function setClaimerFe(uint256 newClaimerFee) external onlyOwner {
		claimerFee = newClaimerFee;
	}

	function setSwapPath(address[] memory newPath) external onlyOwner {
		fxsToFraxPath = newPath;
	}

	function recoverERC20(address _token, uint256 _amount) external onlyOwner {
		IERC20(_token).transfer(owner(), _amount);
	}
}
