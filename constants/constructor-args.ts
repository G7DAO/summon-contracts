// type Tenant = 'Game7' | 'zkSync';
export interface ConstructorArgs {
    name: string;
    symbol: string;
    baseURI: string;
    contractURI: string;
    maxPerMint: number;
    isPaused: boolean;
    devWallet: string;
    royalty: bigint;
    // tenants: Tenant[];
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
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250n,
    },
    TESTNET: {
        name: 'MyBadges',
        symbol: 'MSB',
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/{contractURIHASH}',
        maxPerMint: 1,
        isPaused: false,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250n,
    },
};

export const ItemBoundArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'ItemBound',
        symbol: 'ISB',
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/{contractURIHASH}',
        maxPerMint: 1,
        isPaused: false,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250n,
    },
    TESTNET: {
        name: 'MyItems',
        symbol: 'MI',
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/{contractURIHASH}',
        maxPerMint: 1,
        isPaused: false,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250n,
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
        // TODO: devWallet
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        gatingNftAddress: '0xcc1eBf6Dbb9fF24A745D1cc7F6DC3eeDa5f9fa71',
        // TODO: change this for the final address
        itemsNftAddress: 'FILL_ME',
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
        // TODO: devWallet
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        gatingNftAddress: '0xcc1eBf6Dbb9fF24A745D1cc7F6DC3eeDa5f9fa71',
        itemsNftAddress: '0x613D384640769016985Ed4467aDcbb7D8e63f506',
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
    },
};

export const AvatarBoundV1Args = AvatarBoundArgs;
