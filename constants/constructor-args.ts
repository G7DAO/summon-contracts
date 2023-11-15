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
        name: 'AvatarBound1',
        symbol: 'AVB',
        baseURI: 'https://api.mysoulbound.com/tokens/',
    },
    TESTNET: {
        name: 'AvatarBound_Testnet',
        symbol: 'AVB',
        baseURI: 'https://api.mysoulbound.com/tokens/',
    },
};
