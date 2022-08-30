include .env


zapperTest:; forge test -vvv --fork-url $(MAINNET) --match-contract "SdLiquidityZapperTest" --fork-block-number 15408319 --gas-report --etherscan-api-key $(ETHERSCAN_KEY) 