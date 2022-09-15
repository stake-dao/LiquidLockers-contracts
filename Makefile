include .env

.PHONY: test

zapperTest:; forge test -vvv --fork-url $(MAINNET) --match-contract "SdLiquidityZapperTest" --fork-block-number 15408319  --etherscan-api-key $(ETHERSCAN_KEY) 
test:; forge test -vvv --fork-url $(MAINNET) --match-contract "YearnIntegrationTest" # --etherscan-api-key $(ETHERSCAN_KEY)