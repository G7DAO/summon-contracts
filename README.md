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
