# include .env file and export its env vars
# (-include to ignore error if it does not exist)
-include .env

all: clean build lint test

# Clean
clean :; forge clean

# Builds
build  :; forge build

# Run linter and format
lint   :; pnpm lint

# test
test   :; forge test -vv

deployAvatarBound  :; forge script script/DeployAvatarBound.s.sol:DeployAvatarBoundScript --rpc-url ${RPC_URL} --broadcast --verify -vvvv
deployERC20MockBound  :; forge script script/DeployERC20MockScript.s.sol:DeployERC20MockScript --rpc-url ${RPC_URL} --broadcast --verify -vvvv
