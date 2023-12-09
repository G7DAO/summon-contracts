import { TENANT, CONTRACT_TYPE } from '../constructor-args';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.ZkSync;
const networkType = NETWORK_TYPE.MAINNET;

export const ZKSYNC_MAINNET_CONTRACTS = [
    {
        contractName: 'AvatarBound',
        type: CONTRACT_TYPE.Avatars,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: ['ItemBound', 'LevelsBound'],
        functionCalls: [
            {
                contractName: 'AvatarBound',
                functionName: 'setDefaultItemId',
                args: [10001],
            },
            {
                contractName: 'AvatarBound',
                functionName: 'setSpecialItemId',
                args: [10002],
            },
        ],
    },
    {
        contractName: 'AvatarBoundV1',
        type: CONTRACT_TYPE.Avatars,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: ['ItemBoundV1', 'LevelsBoundV1'],
        functionCalls: [
            {
                contractName: 'AvatarBoundV1',
                functionName: 'setDefaultItemId',
                args: [10001],
            },
            {
                contractName: 'AvatarBoundV1',
                functionName: 'setSpecialItemId',
                args: [10002],
            },
        ],
    },
    {
        contractName: 'ItemBound',
        type: CONTRACT_TYPE.Items,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: ['AvatarBound', 'LevelsBound'],
        functionCalls: [
            { contractName: 'ItemBound', functionName: 'grantRole', args: ['MINTER_ROLE', 'CONTRACT_AvatarBound'] },
            { contractName: 'ItemBound', functionName: 'grantRole', args: ['MINTER_ROLE', 'CONTRACT_LevelsBound'] },
        ],
    },
    {
        contractName: 'ItemBoundV1',
        type: CONTRACT_TYPE.Items,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: true,
        // dependencies: ['AvatarBoundV1'],
        // functionCalls: [
        //     {
        //         contractName: 'ItemBoundV1',
        //         functionName: 'grantRole',
        //         args: ['MINTER_ROLE', 'CONTRACT_AvatarV1Bound'],
        //     },
        //     {
        //         contractName: 'ItemBoundV1',
        //         functionName: 'grantRole',
        //         args: ['MINTER_ROLE', 'CONTRACT_LevelsV1Bound'],
        //     },
        // ],
    },
    {
        contractName: 'LevelsBound',
        type: CONTRACT_TYPE.Levels,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: ['ItemBound', 'AvatarBound'],
    },
    {
        contractName: 'LevelsBoundV1',
        type: CONTRACT_TYPE.Levels,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: ['ItemBoundV1', 'AvatarBoundV1'],
    },
];
