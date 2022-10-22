include .env

.PHONY: test

zapperTest:; forge test -vvv --fork-url $(MAINNET) --match-contract "SdLiquidityZapperTest" --fork-block-number 15408319  --etherscan-api-key $(ETHERSCAN_KEY) 
test:; forge test -vvvv --fork-url $(MAINNET) --match-contract BlackpoolTest --match-test Depositor --fork-block-number  15760497 --etherscan-api-key $(ETHERSCAN_KEY)
coverage:; forge coverage -vvv --fork-url $(MAINNET) --fork-block-number  15760497
fraxVoterTest:; forge test -vvvv --fork-url $(MAINNET) --match-contract "FraxVoterTest" --fork-block-number  15568813   --etherscan-api-key $(ETHERSCAN_KEY) 
boostDelegationTest:; forge test -vvvv --fork-url $(MAINNET) --match-contract "VeBoostDelegationTest" --fork-block-number  15568813   --etherscan-api-key $(ETHERSCAN_KEY) 