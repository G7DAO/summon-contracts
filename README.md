<p align="center">
<br />
<a href="https://achievo.xyz"><img src="https://summon.xyz/hero.png" width="200" alt=""/></a>
<br />
</p>
<h1 align="center">Summon Contracts</h1>
<p align="center">
<a href="https://github.com/G7DAO/achievo-contracts/actions"><img alt="Build Status" src="https://github.com/G7DAO/summon-contracts/actions/workflows/ci.yml/badge.svg"/></a>

</p>
<br />

## Requirements

1. NodeJs >= 21.13.1 (use nvm pls)
2. Fill the .env file with the correct values(see .env.example)
3. Install dependencies

```shell
pnpm install
```

## Deployments

How to deploy a specific contract using the hardhat tasks of this repo:

```shell
pnpm deploy:g7:testnet --name Forwarder
```

You need to provide the **name** argument with the contract name you want to deploy.

## Upgrades

How to upgrade an upgradeable contract with our custom task:

```shell
pnpm run upgrade:arbitrum:sepolia --name GUnits --contractversion 2
```

## Verifications

How to verify a custom interface:
example:

```shell
pnpm hardhat --config arbitrum.config.ts verify --network arbitrumSepolia 0x9A984C46177cf900028e31c0355f541B804e3828
```
