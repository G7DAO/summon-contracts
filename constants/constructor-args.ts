import { CONTRACT_NAME, CONTRACT_UPGRADABLE_NAME } from './contract';
import { ChainId } from './network';

export interface ConstructorArgs {
    name: string;
    symbol: string;
    baseURI: string;
    contractURI: string;
    maxPerMint: number;
    isPaused: boolean;
    devWallet: string;
    royalty?: number;
}
export interface Soulbound1155Args {
    MAINNET: ConstructorArgs;
    TESTNET: ConstructorArgs;
}
export const SoulboundBadgesArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'SoulboundBadges',
        symbol: 'SBB',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: true,
        devWallet: 'DEPLOYER_WALLET',
        royalty: 250,
    },
    TESTNET: {
        name: 'MyBadges',
        symbol: 'MSB',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
        royalty: 250,
    },
};

export const ItemBoundArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'Item',
        symbol: 'ISB',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'MyItems',
        symbol: 'MI',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
};

export const ItemBoundAzerothArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'AzerothItems',
        symbol: 'AItems',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'FILL_ME',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'AzerothItems',
        symbol: 'AItems',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'FILL_ME',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
};

export const ItemsRewardBoundArgs = {
    MAINNET: {
        name: 'AchievoItemsReward',
        symbol: 'AIR',
        defaultRewardId: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'AchievoItemsReward',
        symbol: 'AIR',
        defaultRewardId: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
};

export const NFTGatingArgs = {
    MAINNET: {
        name: 'Achievo NFT Gating Admin Access',
        symbol: 'AchievoAdmin',
        baseURI: 'https://achievo.mypinata.cloud/ipfs/',
        adminTokenURI: 'QmYXxrc4vQgfoRtUhdBCbSbxpeJJs2eEtcgiuXvzxdWfJD',
        superAdminTokenURI: 'Qmay3Db9KFTwoQJ2nB6vTxuHfDX5CQgxmy97NKvcN45B6F',
    },
    TESTNET: {
        name: 'Achievo NFT Gating Admin Access',
        symbol: 'AchievoAdmin',
        baseURI: 'https://achievo.mypinata.cloud/ipfs/',
        adminTokenURI: 'QmYXxrc4vQgfoRtUhdBCbSbxpeJJs2eEtcgiuXvzxdWfJD',
        superAdminTokenURI: 'Qmay3Db9KFTwoQJ2nB6vTxuHfDX5CQgxmy97NKvcN45B6F',
    },
};

export const AvatarBoundArgs = {
    MAINNET: {
        name: 'AvatarBound',
        symbol: 'AVB',
        baseURI: '',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        revealURI: 'Qmdk4zHamwCyqSzuWNNYypuz4FXAGdApbky7SHNsXYYQg7',
        devWallet: 'DEPLOYER_WALLET',
        gatingNftAddress: '0xD07180c423F9B8CF84012aA28cC174F3c433EE29',
        itemsNftAddress: `CONTRACT_${CONTRACT_NAME.Items}`,
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
    },
    TESTNET: {
        name: 'AvatarBound',
        symbol: 'AVB',
        baseURI: '',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        revealURI: 'QmZnvSyeKRQxWwcofVmq41BNCtHbBmomk8Ny8mtGRTjtzS',
        devWallet: 'DEPLOYER_WALLET',
        gatingNftAddress: '0x6E03Ea6c9aBBb78Dd761b9c71c06176c508488C3',
        itemsNftAddress: `CONTRACT_${CONTRACT_NAME.Items}`,
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
    },
};

export const AvatarBoundV1Args = {
    MAINNET: {
        ...AvatarBoundArgs.MAINNET,
        itemsNftAddress: `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`,
    },
    TESTNET: {
        ...AvatarBoundArgs.TESTNET,
        itemsNftAddress: `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`,
    },
};

export const LevelsBoundArgs = {
    MAINNET: {
        name: 'LevelsBound',
        symbol: 'LVL',
        developerAdmin: 'DEPLOYER_WALLET',
        mintRandomItemEnabled: true,
        itemsNFTAddress: `CONTRACT_${CONTRACT_NAME.Items}`,
    },
    TESTNET: {
        name: 'LevelsBound',
        symbol: 'LVL',
        developerAdmin: 'DEPLOYER_WALLET',
        mintRandomItemEnabled: true,
        itemsNFTAddress: `CONTRACT_${CONTRACT_NAME.Items}`,
    },
};

export const LevelsBoundV1Args = {
    MAINNET: {
        ...LevelsBoundArgs.MAINNET,
        itemsNFTAddress: `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`,
    },
    TESTNET: {
        ...LevelsBoundArgs.TESTNET,
        itemsNFTAddress: `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`,
    },
};

export const OpenMintArgs = {
    MAINNET: {
        name: 'OpenMint-TEST',
        symbol: 'OM_TEST',
        baseTokenURI: 'https://achievo.mypinata.cloud/ipfs/',
        unrevealedURI: 'Qmc7c9tNVaaAbTM5RMgdPY7MjPoLDFfPw8BAv3WuBUrebe',
    },
    TESTNET: {
        name: 'OpenMint-TEST',
        symbol: 'OM_TEST',
        baseTokenURI: 'https://achievo.mypinata.cloud/ipfs/',
        unrevealedURI: 'Qmc7c9tNVaaAbTM5RMgdPY7MjPoLDFfPw8BAv3WuBUrebe',
    },
};

const PYTH_USDC_PRICE_ID_TESTNET = '0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722';
const PYTH_ETH_PRICE_ID_TESTNET = '0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6';
const PYTH_ORACLE_ADDRESS_TESTNET = '0x8739d5024B5143278E2b15Bd9e7C26f6CEc658F1';

const PYTH_USDC_PRICE_ID_MAINNET = '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a';
const PYTH_ETH_PRICE_ID_MAINNET = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
const PYTH_ORACLE_ADDRESS_MAINNET = '0xf087c864AEccFb6A2Bf1Af6A0382B0d0f6c5D834';

const CHAINLINK_USDC_PRICE_ID_TESTNET = '0x37FBa63C443Ca1Bf262B9E6cc46c4B46273F687C';
const CHAINLINK_ETH_PRICE_ID_TESTNET = '0x2bBaff398B72d5B26f4f9B3397cfd9DC578a9f08';

const CHAINLINK_USDC_PRICE_ID_MAINNET = '0x1824D297C6d6D311A204495277B63e943C2D376E';
const CHAINLINK_ETH_PRICE_ID_MAINNET = '0x6D41d1dc818112880b40e26BD6FD347E41008eDA';

const ZKSYNC_MAINNET_ERC20_USDC = '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4';
const ZKSYNC_TESTNET_ERC20_OUSDC = '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05';

export const ERC20PythPaymasterArgs = {
    MAINNET: {
        erc20Address: ZKSYNC_MAINNET_ERC20_USDC,
        usdcPriceId: PYTH_USDC_PRICE_ID_MAINNET,
        ethPriceId: PYTH_ETH_PRICE_ID_MAINNET,
        pythOracleAddress: PYTH_ORACLE_ADDRESS_MAINNET,
    },
    TESTNET: {
        erc20Address: ZKSYNC_TESTNET_ERC20_OUSDC,
        usdcPriceId: PYTH_USDC_PRICE_ID_TESTNET,
        ethPriceId: PYTH_ETH_PRICE_ID_TESTNET,
        pythOracleAddress: PYTH_ORACLE_ADDRESS_TESTNET,
    },
};

export const ERC20ChainlinkPaymasterArgs = {
    MAINNET: {
        erc20Address: ZKSYNC_MAINNET_ERC20_USDC,
        erc20FeedId: CHAINLINK_USDC_PRICE_ID_MAINNET,
        ethFeedId: CHAINLINK_ETH_PRICE_ID_MAINNET,
        fixedPrice: 1,
        useChainLink: true,
    },
    TESTNET: {
        erc20Address: ZKSYNC_TESTNET_ERC20_OUSDC,
        erc20FeedId: CHAINLINK_USDC_PRICE_ID_TESTNET,
        ethFeedId: CHAINLINK_ETH_PRICE_ID_TESTNET,
        fixedPrice: 1,
        // This is in "false" because chainlink is not available on zkSync-sepolia yet, anyway check this link:
        // https://docs.chain.link/data-feeds/price-feeds/addresses?network=zksync&page=1
        useChainLink: false,
    },
};

export const GameSummaryArgs = {
    MAINNET: {
        _uri: 'FILL_ME',
    },
    TESTNET: {
        _uri: 'FILL_ME',
    },
};

export const ZKSSPorkV1Args = {
    MAINNET: {
        name: 'ZkSSpork',
        symbol: 'ZkSS',
        developerAdmin: 'DEPLOYER_WALLET',
        decimals: 18,
        regularToken: '0x8A9074144C5041f90330Fef6E2fE96A0593Ebc3f',
    },
    TESTNET: {
        name: 'ZkSSpork',
        symbol: 'ZkSS',
        developerAdmin: 'DEPLOYER_WALLET',
        decimals: 18,
        regularToken: 'FILL_ME',
    },
};

export const BridgePolygonV1Args = {
    MAINNET: {
        developerAdmin: 'DEPLOYER_WALLET',
        chainIdFrom: ChainId.Polygon,
        chainIdTo: ChainId.ZkSync,
    },
    TESTNET: {
        developerAdmin: 'DEPLOYER_WALLET',
        chainIdFrom: ChainId.PolygonMumbai,
        chainIdTo: ChainId.ZkSyncSepolia,
    },
};

export const BridgeZkSyncV1Args = {
    MAINNET: {
        developerAdmin: 'DEPLOYER_WALLET',
        chainIdFrom: ChainId.ZkSync,
        chainIdTo: ChainId.Polygon,
    },
    TESTNET: {
        developerAdmin: 'DEPLOYER_WALLET',
        chainIdFrom: ChainId.ZkSyncSepolia,
        chainIdTo: ChainId.PolygonMumbai,
    },
};

export const WhitelistArgs = {
    MAINNET: {
        developerAdmin: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        developerAdmin: 'DEPLOYER_WALLET',
    },
};

export const BurnableTokenV1Args = {
    MAINNET: {
        name: 'SPORK',
        symbol: 'SPORK',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'SPORK',
        symbol: 'SPORK',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
};

export const BadgeBoundArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'Item',
        symbol: 'ISB',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'Badge',
        symbol: 'BADGE',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
};

export const BUIDLArgs = {
    MAINNET: {
        name: 'BUIDL',
        symbol: 'BUIDL',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'MOCKERC20',
        symbol: 'ERC20',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
};
