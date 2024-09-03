<p align="center">
<br />
<a href="https://achievo.xyz"><img src="https://docs.achievo.xyz/assets/images/achievo_hero-c6f48974170f838b624d0b30ef52735f.png" width="200" alt=""/></a>
<br />
</p>
<h1 align="center">Achievo Contracts</h1>
<p align="center">
<a href="https://github.com/G7DAO/achievo-contracts/actions"><img alt="Build Status" src="https://github.com/G7DAO/achievo-contracts/actions/workflows/ci.yml/badge.svg"/></a>

</p>
<br />

## Requirements

1. NodeJs >= 18 (use nvm pls)
2. Fill the .env file with the correct values(see .env.example)
3. Install dependencies

```shell
pnpm install
```

## Scripts

```json
{
    "deploy:create2": "pnpm compile && hardhat --config hardhat.config.ts deploy-create2",
    "deploy:nonce": "pnpm compile && hardhat --config hardhat.config.ts deploy-nonce",
    "deploy:proxy": "pnpm compile && hardhat --config hardhat.config.ts deploy-proxy",
    "deploy:sepolia": "pnpm compile && hardhat --config hardhat.config.ts deploy --network sepolia",
    "deploy:arbitrum:one": "pnpm compile && hardhat --config arbitrum.config.ts deploy --network arbitrumOne",
    "deploy:arbitrum:sepolia": "pnpm compile && hardhat --config arbitrum.config.ts deploy --network arbitrumSepolia",
    "deploy:base:mainnet": "pnpm compile && hardhat --config base.config.ts deploy --network base",
    "deploy:base:sepolia": "pnpm compile && hardhat --config base.config.ts deploy --network baseSepolia",
    "deploy:mantle:mainnet": "pnpm compile && hardhat --config mantle.config.ts deploy --network mantle",
    "deploy:mantle:sepolia": "pnpm compile && hardhat --config mantle.config.ts deploy --network mantleSepolia",
    "deploy:polygon:mainnet": "pnpm compile && hardhat --config polygon.config.ts deploy --network polygon",
    "deploy:polygon:mumbai": "pnpm compile && hardhat --config polygon.config.ts deploy --network polygonMumbai",
    "deploy:g7:testnet": "pnpm compile && hardhat --config g7.config.ts deploy --network game7Testnet",
    "test:foundry": "forge test -vvv",
    "test": "REPORT_GAS=true hardhat --config hardhat.config.ts test test/hardhatTests/*.ts --network hardhat",
    "test:ci": "hardhat --config hardhat.config.ts test test/hardhatTests/*.ts  --network hardhat",
    "lint": "eslint --config ./.eslintrc.js --ignore-path ./.eslintignore ./test/**/*.ts",
    "solhint": "solhint ./contracts/**/*.sol",
    "format": "yarn prettier -w ./deploy/**/*.ts ./tasks/**/*.ts ./tests/**/*.ts ./helpers/**/*.ts contracts/**/*.sol ",
    "format:check": "yarn prettier -c ./deploy/**/*.ts ./tasks/**/*.ts ./tests/**/*.ts ./helpers/**/*.ts ./contracts/**/*.sol ",
    "coverage": "TS_NODE_TRANSPILE_ONLY=true SOLIDITY_COVERAGE=true hardhat coverage  --solcoverjs .solcover.ts",
    "coverage:foundry": "forge coverage --report lcov && genhtml lcov.info --branch-coverage --output-dir coverage",
    "generate:types": "pnpm dlx hardhat typechain"
}
```
