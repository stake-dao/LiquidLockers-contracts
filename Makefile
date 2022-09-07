include .env


zapperTest:; forge test -vvv --fork-url $(MAINNET) --match-contract "SdLiquidityZapperTest" --fork-block-number 15408319  --etherscan-api-key $(ETHERSCAN_KEY) 
fyiLockerTest:; forge test -vvv --fork-url $(MAINNET) --match-contract "YearnLockerTest" --fork-block-number 15408319  --etherscan-api-key $(ETHERSCAN_KEY)