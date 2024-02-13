# Achievo Contracts

![Version](https://img.shields.io/badge/version-0.15.1-brightgreen)

![Achievo](https://docs.achievo.xyz/assets/images/achievo_hero-c6f48974170f838b624d0b30ef52735f.png)

This is a EIP-2535 diamond implementation for the Achievo project - Achievement system.

The latest contracts use Transparent Proxies and not the diamond pattern.

Also for a specific contracts there's no proxy like : GameSummary1155.sol

Or the proxy is just the beacon proxy like: LevelsBound.sol

## Requirements

1. NodeJs >= 18 (use nvm pls)
2. Fill the .env file with the correct values(see .env.example)
3. Install dependencies

```shell
npm install
```

To deploy the current diamond to the zkSync testnet network, run the following command

4. `npm run compile`
5. `npm run deployDiamond:localhost`

This command will run the script of

**/deploy/zk/deployDiamond.ts**

```shell
npm run deployDiamond:ZkSync
```

You can also try the achievements erc1155 smart contract
**/deploy/zk/deployAvatar.ts**

```shell
npm run deployAvatar:ZkSync
```

## Commands

1. This command will setup a hardhat node for you, could be used for testing as Ganache

```shell
 npm run localChain
```

2. This command will run a diamond deployment for Mantle on:

```shell
npm run deployDiamond:mantle
```

3. This command will run a diamond deployment for Polygon mumbai on:

```shell
npm run deployDiamond:mumbai
```

Check the rest of the scripts in the package.json file

4. Run the unit tests

```shell
npm test
```

5. Flat smart contracts

```shell
npx hardhat flatten contracts/GameSummary.sol > .flat/GameSummary.sol
```
