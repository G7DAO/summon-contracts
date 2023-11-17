type Tenant = 'Game7' | 'zkSync';
export interface ConstructorArgs {
    name: string;
    symbol: string;
    baseURI: string;
    maxPerMint: number;
    isPaused: boolean;
    devWallet: string;
    royalty: number;
    tenants: Tenant[];
}
export interface SoulBound1155Args {
    MAINNET: ConstructorArgs;
    TESTNET: ConstructorArgs;
}
export const SoulBoundBadgesArgs: SoulBound1155Args = {
    MAINNET: {
        name: 'SoulBoundBadges',
        symbol: 'SBB',
        baseURI: 'https://api.mysoulbound.com/tokens/',
        maxPerMint: 1,
        isPaused: true,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250,
        tenants: ['Game7', 'zkSync'],
    },
    TESTNET: {
        name: 'MyBadges',
        symbol: 'MSB',
        baseURI: 'https://api.mysoulbound.com/tokens/',
        maxPerMint: 1,
        isPaused: true,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250,
        tenants: ['Game7', 'zkSync'],
    },
};

export const ItemsBoundArgs: SoulBound1155Args = {
    MAINNET: {
        name: 'ItemsBound',
        symbol: 'ISB',
        baseURI: 'https://api.mysoulbound.com/tokens/',
        maxPerMint: 1,
        isPaused: true,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250,
        tenants: ['Game7', 'zkSync'],
    },
    TESTNET: {
        name: 'MyItems',
        symbol: 'MI',
        baseURI: 'https://api.itemsbound.com/tokens/',
        maxPerMint: 1,
        isPaused: true,
        devWallet: '0xA10648F8618A526Bd0Acb08a1b9f413BC44Fcb4B',
        royalty: 250,
        tenants: ['Game7', 'zkSync'],
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
        // TODO: change this for the final address
        itemsNftAddress: 'FILL_ME',
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        blockExplorerBaseUrl: 'https://explorer.zksync.io',
        tenants: ['zkSync'],
    },
    TESTNET: {
        name: 'AvatarBoundV1',
        symbol: 'AVB',
        baseURI: 'https://apricot-persistent-duck-562.mypinata.cloud/',
        contractURI: 'https://apricot-persistent-duck-562.mypinata.cloud/{contractURIHASH}',
        gatingNftAddress: '0xcc1eBf6Dbb9fF24A745D1cc7F6DC3eeDa5f9fa71',
        itemsNftAddress: '0x482B4efC7c192567fDF51C5Bc8127279d63013F1',
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        blockExplorerBaseUrl: 'https://goerli.explorer.zksync.io',
        tenants: ['zkSync'],
    },
};
