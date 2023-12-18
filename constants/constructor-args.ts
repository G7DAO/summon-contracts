export enum TENANT {
    Game7 = 'Game7',
    ZkSync = 'zkSync',
}

export enum CONTRACT_TYPE {
    Avatars = 'Avatars',
    Items = 'Items',
    Levels = 'Levels',
    OpenMint = 'OpenMint',
    Paymaster = 'Paymaster',
}

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

export const ItemBoundV1Args: Soulbound1155Args = ItemBoundArgs;

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
        // TODO: change this for the final gateway
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        // TODO: change this for the final gateway
        contractURI:
            'https://apricot-persistent-duck-562.mypinata.cloud/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        revealURI: 'FILL_ME',
        devWallet: 'DEPLOYER_WALLET',
        gatingNftAddress: '0xD07180c423F9B8CF84012aA28cC174F3c433EE29',
        itemsNftAddress: 'CONTRACT_ItemBound',
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
    },
    TESTNET: {
        name: 'AvatarBound',
        symbol: 'AVB',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        revealURI: 'QmZnvSyeKRQxWwcofVmq41BNCtHbBmomk8Ny8mtGRTjtzS',
        devWallet: 'DEPLOYER_WALLET',
        gatingNftAddress: '0xcc1eBf6Dbb9fF24A745D1cc7F6DC3eeDa5f9fa71',
        itemsNftAddress: 'CONTRACT_ItemBound',
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
    },
};

export const AvatarBoundV1Args = {
    MAINNET: {
        ...AvatarBoundArgs.MAINNET,
        itemsNftAddress: 'CONTRACT_ItemBoundV1',
    },
    TESTNET: {
        ...AvatarBoundArgs.TESTNET,
        itemsNftAddress: 'CONTRACT_ItemBoundV1',
    },
};

export const LevelsBoundArgs = {
    MAINNET: {
        name: 'LevelsBound',
        symbol: 'LVL',
        developerAdmin: 'DEPLOYER_WALLET',
        mintRandomItemEnabled: true,
        itemsNFTAddress: 'CONTRACT_ItemBound',
    },
    TESTNET: {
        name: 'LevelsBound',
        symbol: 'LVL',
        developerAdmin: 'DEPLOYER_WALLET',
        mintRandomItemEnabled: true,
        itemsNFTAddress: 'CONTRACT_ItemBound',
    },
};

export const LevelsBoundV1Args = {
    MAINNET: {
        ...LevelsBoundArgs.MAINNET,
        itemsNFTAddress: 'CONTRACT_ItemBoundV1',
    },
    TESTNET: {
        ...LevelsBoundArgs.TESTNET,
        itemsNFTAddress: 'CONTRACT_ItemBoundV1',
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

const USDC_PRICE_ID_TESTNET = '0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722';
const ETH_PRICE_ID_TESTNET = '0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6';
const PYTH_ORACLE_ADDRESS_TESTNET = '0x8739d5024B5143278E2b15Bd9e7C26f6CEc658F1';

const USDC_PRICE_ID_MAINNET = '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a';
const ETH_PRICE_ID_MAINNET = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
const PYTH_ORACLE_ADDRESS_MAINNET = '0xf087c864AEccFb6A2Bf1Af6A0382B0d0f6c5D834';

const MAINNET_ERC20_USDC = '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4';
const TESTNET_ERC20_OUSDC = '0xA79498e38264330603F00AfEC577539B4b5D6F51';

export const ERC20PythPaymasterArgs = {
    MAINNET: {
        erc20Address: MAINNET_ERC20_USDC,
        usdcPriceId: USDC_PRICE_ID_MAINNET,
        ethPriceId: ETH_PRICE_ID_MAINNET,
        pythOracleAddress: PYTH_ORACLE_ADDRESS_MAINNET,
    },
    TESTNET: {
        erc20Address: TESTNET_ERC20_OUSDC,
        usdcPriceId: USDC_PRICE_ID_TESTNET,
        ethPriceId: ETH_PRICE_ID_TESTNET,
        pythOracleAddress: PYTH_ORACLE_ADDRESS_TESTNET,
    },
};

export const ERC20ChainlinkPaymasterArgs = {
    MAINNET: {
        erc20Address: MAINNET_ERC20_USDC,
        erc20FeedId: '0x1824D297C6d6D311A204495277B63e943C2D376E',
        ethFeedId: '0x6D41d1dc818112880b40e26BD6FD347E41008eDA',
    },
    TESTNET: {
        erc20Address: TESTNET_ERC20_OUSDC,
        erc20FeedId: '0x37FBa63C443Ca1Bf262B9E6cc46c4B46273F687C',
        ethFeedId: '0x2bBaff398B72d5B26f4f9B3397cfd9DC578a9f08',
    },
};
