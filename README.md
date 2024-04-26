
<p align="center">
<br />
<a href="https://thirdweb.com"><img src="https://docs.achievo.xyz/assets/images/achievo_hero-c6f48974170f838b624d0b30ef52735f.png" width="200" alt=""/></a>
<br />
</p>
<h1 align="center">Achievo Contracts</h1>
<p align="center">
<a href="https://github.com/G7DAO/achievo-contracts/actions"><img alt="Build Status" src="https://github.com/thirdweb-dev/contracts/actions/workflows/tests.yml/badge.svg"/></a>

</p>
<br />


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

## Scripts

```json
{
    "deployBridge:polygon:mainnet": "pnpm deploy:polygon:mainnet --name BridgePolygon",
    "deployBridge:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name BridgeZkSync",
    "deployERC20StakeUpgradeable:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name ERC20StakeV1",
    "deployWhitelist:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name Whitelist",
    "deployBridgeUpgradeable:polygon:mainnet": "pnpm deploy:polygon:mainnet --name BridgeUpgradeablePolygon",
    "deployBridgeUpgradeable:zksync:mainnet": "pnpm deploy:ZkSync:mainnet --name BridgeUpgradeableZkSync",
    "deployBurnableToken:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name ZkSpork",
    "deployFreeMint:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name FreeMint",
    "deployFreeMint:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name FreeMint",
    "deployAvatars:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name Avatars",
    "deployAvatars:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name Avatars",
    "deployAvatarsUpgradeable:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name AvatarsUpgradable",
    "deployAvatarsUpgradeable:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name AvatarsUpgradable",
    "upgradeAvatars:ZkSync:mainnet": "pnpm compile:zkSync && hardhat run deploy/upgrades/upgradeAvatars.mainnet.ts --config zkSync.config.ts --network zkSync",
    "upgradeAvatars:ZkSync:sepolia": "pnpm compile:zkSync && hardhat run deploy/upgrades/upgradeAvatars.testnet.ts --config zkSync.config.ts --network zkSyncSepolia",
    "deployItems:arbitrum:one": "pnpm deploy:arbitrum:one --name Items",
    "deployItems:arbitrum:sepolia": "pnpm deploy:arbitrum:sepolia --name Items",
    "deployItems:polygon:mainnet": "pnpm deploy:polygon:mainnet --name Items",
    "deployItems:polygon:mumbai": "pnpm deploy:polygon:mumbai --name Items",
    "deployItems:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name Items",
    "deployItems:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name Items",
    "deployItemsUpgradeable:arbitrum:one": "pnpm deploy:arbitrum:one --name ItemsUpgradable",
    "deployItemsUpgradeable:arbitrum:sepolia": "pnpm deploy:arbitrum:sepolia --name ItemsUpgradable",
    "deployItemsUpgradeable:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name ItemsUpgradable",
    "deployItemsUpgradeable:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name ItemsUpgradable",
    "upgradeItem:ZkSync:mainnet": "pnpm compile:zkSync && hardhat run deploy/upgrades/upgradeItem.mainnet.ts --config zkSync.config.ts --network zkSync",
    "upgradeItem:ZkSync:sepolia": "pnpm compile:zkSync && hardhat run deploy/upgrades/upgradeItem.testnet.ts --config zkSync.config.ts --network zkSyncSepolia",
    "deployItemsReward:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name RewardItems",
    "deployItemsReward:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name RewardItems",
    "deployLevelsOnChain:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name Levels",
    "deployLevelsOnChain:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name Levels",
    "deployLevelsOnChainUpgradable:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name LevelsUpgradable",
    "deployLevelsOnChainUpgradable:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name LevelsUpgradable",
    "upgradeLevels:ZkSync:mainnet": "pnpm compile:zkSync && hardhat run deploy/upgrades/upgradeLevels.mainnet.ts --config zkSync.config.ts --network zkSync",
    "upgradeLevels:ZkSync:sepolia": "pnpm compile:zkSync && hardhat run deploy/upgrades/upgradeLevels.testnet.ts --config zkSync.config.ts --network zkSyncSepolia",
    "mintItemsReward:ZkSync:mainnet": "pnpm compile:zkSync && hardhat --config zkSync.config.ts deploy-zksync --network zkSync --script mints/mintRewardItems.ts",
    "mintItemsReward:ZkSync:sepolia": "pnpm compile:zkSync && hardhat --config zkSync.config.ts deploy-zksync --network zkSyncSepolia --script mints/mintRewardItems.ts",
    "deployMockERC20:ZkSync:sepolia": "pnpm compile:zkSync && hardhat run deploy/deployMockERC20.testnet.ts --network zkSyncSepolia --config zkSync.config.ts",
    "deployNftGating:ZkSync:mainnet": "pnpm compile:zkSync && hardhat --config zkSync.config.ts deploy-zksync --network zkSync --script deployNFTGating.mainnet.ts",
    "deployNftGating:ZkSync:sepolia": "pnpm compile:zkSync && hardhat --config zkSync.config.ts deploy-zksync --network zkSyncSepolia --script deployNFTGating.testnet.ts",
    "deployERC20PythPaymaster:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name PaymasterPyth",
    "deployERC20PythPaymaster:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name PaymasterPyth",
    "deployERC20ChainlinkPaymaster:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name PaymasterChainlink",
    "deployERC20ChainlinkPaymaster:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name PaymasterChainlink",
    "deployERC20ChainlinkUpgradeablePaymaster:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name PaymasterChainlinkUpgradable",
    "deployERC20ChainlinkUpgradeablePaymaster:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name PaymasterChainlinkUpgradable",
    "upgradeERC20ChainlinkPaymaster:ZkSync:mainnet": "pnpm compile:zkSync && hardhat run deploy/upgrades/upgradeERC20ChainlinkPaymaster.mainnet.ts --config zkSync.config.ts --network zkSync",
    "deployGameSummary:mantle:mainnet": "pnpm deploy:mantle:mainnet --name GameSummary",
    "deployGameSummary:mantle:wadsley": "pnpm deploy:mantle:wadsley --name GameSummary",
    "deployBadge:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name Badge",
    "deployBadge:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name Badge",
    "deployBadgeUpgradeable:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name BadgeUpgradable",
    "deployBadgeUpgradeable:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name BadgeUpgradable",
    "upgradeBadge:ZkSync:mainnet": "pnpm compile:zkSync && hardhat run deploy/upgrades/upgradeBadge.mainnet.ts --config zkSync.config.ts --network zkSync",
    "upgradeBadge:ZkSync:sepolia": "pnpm compile:zkSync && hardhat run deploy/upgrades/upgradeBadge.testnet.ts --config zkSync.config.ts --network zkSyncSepolia",
    "deploySkillTreeUpgradable:ZkSync:mainnet": "pnpm deploy:ZkSync:mainnet --name SkillTreeUpgradable",
    "deploySkillTreeUpgradable:ZkSync:sepolia": "pnpm deploy:ZkSync:sepolia --name SkillTreeUpgradable",
    "deployMarketplace:g7:arb:sepolia": "pnpm deploy:g7:sepolia:arb --name Marketplace",
    "deployMarketplace:g7:base:sepolia": "pnpm deploy:g7:sepolia:base --name Marketplace"
}
```
