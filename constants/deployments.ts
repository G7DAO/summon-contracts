export const CONTRACTS = [
    {
        contractName: 'AvatarBound',
        type: 'Avatar',
        chain: 'zkSyncTestnet',
        networkType: 'TESTNET',
        tenants: ['game7', 'zkSync'],
        verify: true,
        upgradable: false,
        dependencies: ['ItemBound'],
        functionCalls: [{ contractName: 'AvatarBound', functionName: 'setAvatarContract', args: ['avatarAddress'] }],
    },
    {
        contractName: 'ItemBound',
        type: 'Items',
        chain: 'zkSyncTestnet',
        networkType: 'TESTNET',
        tenants: ['game7', 'zkSync'],
        verify: true,
        upgradable: false,
        dependencies: ['AvatarBound'],
        functionCalls: [{ contractName: 'ItemBoundV1', functionName: 'setAvatarContract', args: ['avatarAddress'] }],
    },

    {
        contractName: 'ItemBoundV1',
        type: 'Items',
        chain: 'zkSyncTestnet',
        networkType: 'TESTNET',
        tenants: ['game7', 'zkSync'],
        verify: true,
        upgradable: true,
        dependencies: ['AvatarBound'],
        functionCalls: [{ contractName: 'ItemBoundV1', functionName: 'setAvatarContract', args: ['avatarAddress'] }],
    },
    {
        contractName: 'OpenMint',
        type: 'OpenMint',
        chain: 'zkSyncTestnet',
        networkType: 'TESTNET',
        tenants: ['game7', 'zkSync'],
        verify: true,
        upgradable: false,
        dependencies: ['AvatarBound'],
        functionCalls: [{ contractName: 'AvatarBound', functionName: 'setAvatarContract', args: ['avatarAddress'] }],
    },
];
