include .env

.PHONY: test
default:; forge fmt && forge build

.EXPORT_ALL_VARIABLES:
FOUNDRY_ETH_RPC_URL=${MAINNET}
FOUNDRY_FORK_BLOCK_NUMBER=15918886
ETHERSCAN_API_KEY==${ETHERSCAN_KEY}

coverage:; @forge coverage --match-contract AngleTest
zapperTest:; forge test -vvv --fork-url $(MAINNET) --match-contract "SdLiquidityZapperTest" --fork-block-number 15408319  --etherscan-api-key $(ETHERSCAN_KEY) 
fraxVoterTest:; forge test -vvvv --fork-url $(MAINNET) --match-contract "FraxVoterTest" --fork-block-number  15568813   --etherscan-api-key $(ETHERSCAN_KEY) 
boostDelegationTest:; forge test -vvvv --fork-url $(MAINNET) --match-contract "VeBoostDelegationTest" --fork-block-number  15568813   --etherscan-api-key $(ETHERSCAN_KEY) 

test-angle:; @forge test --match-contract AngleTest --match-test testAccumulator -vvv --etherscan-api-key $(ETHERSCAN_KEY) 
test-blackpool:; @forge test --match-contract BlackpoolTest