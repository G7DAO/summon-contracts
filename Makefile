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
test   :; forge test

deployAvatarBound  :; forge script script/DeployAvatarBound.s.sol:DeployAvatarBoundScript --rpc-url ${RPC_URL} --broadcast --verify -vvvv
