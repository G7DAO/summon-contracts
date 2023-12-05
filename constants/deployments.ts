import { TENANT, CONTRACT_TYPE } from './constructor-args';
import { NETWORK_TYPE, NetworkName } from './network';

export const CONTRACTS = [
    {
        contractName: 'AvatarBound',
        type: CONTRACT_TYPE.Avatar,
        chain: NetworkName.ZkSyncTestnet,
        networkType: NETWORK_TYPE.TESTNET,
        tenants: [TENANT.Game7, TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: ['ItemBound', 'LevelsBound'],
    },
    {
        contractName: 'AvatarBoundV1',
        type: CONTRACT_TYPE.Avatar,
        chain: NetworkName.ZkSyncTestnet,
        networkType: NETWORK_TYPE.TESTNET,
        tenants: [TENANT.Game7, TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: ['ItemBoundV1', 'LevelsBoundV1'],
    },
    {
        contractName: 'ItemBound',
        type: CONTRACT_TYPE.Items,
        chain: NetworkName.ZkSyncTestnet,
        networkType: NETWORK_TYPE.TESTNET,
        tenants: [TENANT.Game7, TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: ['AvatarBound', 'LevelsBound'],
        functionCalls: [
            { contractName: 'ItemBound', functionName: 'setAvatarContract', args: ['avatarAddress'] },
            { contractName: 'ItemBound', functionName: 'setAvatarContract', args: ['avatarAddress'] },
            { contractName: 'ItemBound', functionName: 'setAvatarContract', args: ['avatarAddress'] },
        ],

        // grantRole -> AvatarBound, LevelsBound
    },

    {
        contractName: 'ItemBoundV1',
        type: CONTRACT_TYPE.Items,
        chain: NetworkName.ZkSyncTestnet,
        networkType: NETWORK_TYPE.TESTNET,
        tenants: [TENANT.Game7, TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: ['AvatarBoundV1'],
        functionCalls: [
            { contractName: 'ItemBound', functionName: 'setAvatarContract', args: ['avatarAddress'] },
            { contractName: 'ItemBound', functionName: 'setAvatarContract', args: ['avatarAddress'] },
            { contractName: 'ItemBound', functionName: 'setAvatarContract', args: ['CONTRACT_LevelsBound'] },
        ],
    },
    {
        contractName: 'LevelsBound',
        type: CONTRACT_TYPE.Levels,
        chain: NetworkName.ZkSyncTestnet,
        networkType: NETWORK_TYPE.TESTNET,
        tenants: [TENANT.Game7, TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: ['ItemBound', 'AvatarBound'],
        functionCalls: [],
    },
    {
        contractName: 'LevelsBoundV1',
        type: CONTRACT_TYPE.Levels,
        chain: NetworkName.ZkSyncTestnet,
        networkType: NETWORK_TYPE.TESTNET,
        tenants: [TENANT.Game7, TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: ['ItemBoundV1', 'AvatarBoundV1'],
        functionCalls: [],
    },
];
