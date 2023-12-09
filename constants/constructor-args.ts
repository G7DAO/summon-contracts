export enum TENANT {
    Game7 = 'Game7',
    ZkSync = 'zkSync',
}

export enum CONTRACT_TYPE {
    Avatars = 'Avatars',
    Items = 'Items',
    Levels = 'Levels',
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
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/{contractURIHASH}',
        maxPerMint: 1,
        isPaused: true,
        devWallet: 'DEPLOYER_WALLET',
        royalty: 250,
    },
    TESTNET: {
        name: 'MyBadges',
        symbol: 'MSB',
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/{contractURIHASH}',
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
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/{contractURIHASH}',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'MyItems',
        symbol: 'MI',
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/{contractURIHASH}',
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
        baseURI: 'https://summon.mypinata.cloud/ipfs/',
        adminTokenURI: 'QmYXxrc4vQgfoRtUhdBCbSbxpeJJs2eEtcgiuXvzxdWfJD',
        superAdminTokenURI: 'Qmay3Db9KFTwoQJ2nB6vTxuHfDX5CQgxmy97NKvcN45B6F',
    },
    TESTNET: {
        name: 'Achievo NFT Gating Admin Access',
        symbol: 'AchievoAdmin',
        baseURI: 'https://summon.mypinata.cloud/ipfs/',
        adminTokenURI: 'QmYXxrc4vQgfoRtUhdBCbSbxpeJJs2eEtcgiuXvzxdWfJD',
        superAdminTokenURI: 'Qmay3Db9KFTwoQJ2nB6vTxuHfDX5CQgxmy97NKvcN45B6F',
    },
};

export const AvatarBoundArgs = {
    MAINNET: {
        name: 'AvatarBound',
        symbol: 'AVB',
        // TODO: change this for the final gateway
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        // TODO: change this for the final gateway
        contractURI: 'https://apricot-persistent-duck-562.mypinata.cloud/{contractURIHASH}',
        revealURI: 'FILL_ME',
        devWallet: 'DEPLOYER_WALLET',
        gatingNftAddress: '0xcc1eBf6Dbb9fF24A745D1cc7F6DC3eeDa5f9fa71',
        itemsNftAddress: 'CONTRACT_ItemBound',
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
    },
    TESTNET: {
        name: 'AvatarBound',
        symbol: 'AVB',
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/{contractURIHASH}',
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

export const AvatarBoundV1Args = AvatarBoundArgs;

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
