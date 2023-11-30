type Tenant = 'Game7' | 'zkSync';
export interface ConstructorArgs {
    name: string;
    symbol: string;
    baseURI: string;
    contractURI: string;
    maxPerMint: number;
    isPaused: boolean;
    devWallet: string;
    royalty: bigint;
    tenants: Tenant[];
}
export interface Soulbound1155Args {
    MAINNET: ConstructorArgs;
    TESTNET: ConstructorArgs;
}
export const SoulboundBadgesArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'SoulboundBadges',
        symbol: 'SBB',
        // TODO: change this for the final gateway
        baseURI: 'https://apricot-persistent-duck-562.mypinata.cloud/',
        // TODO: change this for the final gateway
        contractURI: 'https://apricot-persistent-duck-562.mypinata.cloud/{contractURIHASH}',
        maxPerMint: 1,
        isPaused: true,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250n,
        tenants: ['Game7', 'zkSync'],
    },
    TESTNET: {
        name: 'MyBadges',
        symbol: 'MSB',
        baseURI: 'https://apricot-persistent-duck-562.mypinata.cloud/',
        contractURI: 'https://apricot-persistent-duck-562.mypinata.cloud/{contractURIHASH}',
        maxPerMint: 1,
        isPaused: true,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250n,
        tenants: ['Game7', 'zkSync'],
    },
};

export const ItemsBoundArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'ItemsBound',
        symbol: 'ISB',
        // TODO: change this for the final gateway
        baseURI: 'https://apricot-persistent-duck-562.mypinata.cloud/',
        // TODO: change this for the final gateway
        contractURI: 'https://apricot-persistent-duck-562.mypinata.cloud/{contractURIHASH}',
        maxPerMint: 1,
        isPaused: true,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250n,
        tenants: ['Game7', 'zkSync'],
    },
    TESTNET: {
        name: 'MyItems',
        symbol: 'MI',
        baseURI: 'https://apricot-persistent-duck-562.mypinata.cloud/',
        contractURI: 'https://apricot-persistent-duck-562.mypinata.cloud/{contractURIHASH}',
        maxPerMint: 1,
        isPaused: true,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250n,
        tenants: ['Game7', 'zkSync'],
    },
};

export const NFTGatingArgs = {
    MAINNET: {
        name: 'Achievo NFT Gating Admin Access',
        symbol: 'AchievoAdmin',
        baseURI: 'https://summon.mypinata.cloud/ipfs/',
        adminTokenURI: 'QmYXxrc4vQgfoRtUhdBCbSbxpeJJs2eEtcgiuXvzxdWfJD',
        superAdminTokenURI: 'Qmay3Db9KFTwoQJ2nB6vTxuHfDX5CQgxmy97NKvcN45B6F',
        tenants: ['zkSync'],
    },
    TESTNET: {
        name: 'Achievo NFT Gating Admin Access',
        symbol: 'AchievoAdmin',
        baseURI: 'https://summon.mypinata.cloud/ipfs/',
        adminTokenURI: 'QmYXxrc4vQgfoRtUhdBCbSbxpeJJs2eEtcgiuXvzxdWfJD',
        superAdminTokenURI: 'Qmay3Db9KFTwoQJ2nB6vTxuHfDX5CQgxmy97NKvcN45B6F',
        tenants: ['zkSync'],
    },
};

export const AvatarBoundArgs = {
    MAINNET: {
        name: 'AvatarBoundV1',
        symbol: 'AVB',
        // TODO: change this for the final gateway
        baseURI: 'https://apricot-persistent-duck-562.mypinata.cloud/',
        // TODO: change this for the final gateway
        contractURI: 'https://apricot-persistent-duck-562.mypinata.cloud/{contractURIHASH}',
        gatingNftAddress: '0xcc1eBf6Dbb9fF24A745D1cc7F6DC3eeDa5f9fa71',
        revealURI: 'FILL_ME',
        // TODO: change this for the final address
        itemsNftAddress: 'FILL_ME',
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
        blockExplorerBaseUrl: 'https://explorer.zksync.io',
        tenants: ['zkSync'],
    },
    TESTNET: {
        name: 'AvatarBoundV1',
        symbol: 'AVB',
        baseURI: 'https://apricot-persistent-duck-562.mypinata.cloud/',
        contractURI: 'https://apricot-persistent-duck-562.mypinata.cloud/{contractURIHASH}',
        gatingNftAddress: '0xcc1eBf6Dbb9fF24A745D1cc7F6DC3eeDa5f9fa71',
        itemsNftAddress: '0x613D384640769016985Ed4467aDcbb7D8e63f506',
        revealURI: 'QmZnvSyeKRQxWwcofVmq41BNCtHbBmomk8Ny8mtGRTjtzS',
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
        blockExplorerBaseUrl: 'https://goerli.explorer.zksync.io',
        tenants: ['zkSync'],
    },
};
