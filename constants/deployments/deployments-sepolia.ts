import {
    AvatarBoundArgs,
    AvatarBoundV1Args,
    ERC20ChainlinkPaymasterArgs,
    ItemBoundArgs,
    LevelsBoundArgs,
    LevelsBoundV1Args,
    OpenMintArgs,
} from '@constants/constructor-args';
import {
    CONTRACT_FILE_NAME,
    CONTRACT_NAME,
    CONTRACT_TYPE,
    CONTRACT_UPGRADABLE_FILE_NAME,
    CONTRACT_UPGRADABLE_NAME,
} from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.Sepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const SEPOLIA_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.Avatars,
        type: CONTRACT_TYPE.Avatars,
        name: CONTRACT_NAME.Avatars,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.Items, CONTRACT_NAME.Levels],
        functionCalls: [
            {
                contractName: CONTRACT_NAME.Avatars,
                functionName: 'setDefaultItemId',
                args: [10001],
            },
            {
                contractName: CONTRACT_NAME.Avatars,
                functionName: 'setSpecialItemId',
                args: [10002],
            },
        ],
        args: AvatarBoundArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Avatars,
        type: CONTRACT_TYPE.Avatars,
        name: CONTRACT_UPGRADABLE_NAME.Avatars,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: [CONTRACT_NAME.FreeMint, CONTRACT_UPGRADABLE_NAME.Items, CONTRACT_UPGRADABLE_NAME.Levels],
        functionCalls: [
            {
                contractName: CONTRACT_UPGRADABLE_NAME.Avatars,
                functionName: 'setDefaultItemId',
                args: [10001],
            },
            {
                contractName: CONTRACT_UPGRADABLE_NAME.Avatars,
                functionName: 'setSpecialItemId',
                args: [10002],
            },
        ],
        args: AvatarBoundV1Args.TESTNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.ERC1155RoyaltiesSoulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_NAME.Items,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.Avatars, CONTRACT_NAME.Levels],
        functionCalls: [
            {
                contractName: CONTRACT_NAME.Items,
                functionName: 'grantRole',
                args: ['MINTER_ROLE', `CONTRACT_${CONTRACT_NAME.Avatars}`],
            },
            {
                contractName: CONTRACT_NAME.Items,
                functionName: 'grantRole',
                args: ['MINTER_ROLE', `CONTRACT_${CONTRACT_NAME.Levels}`],
            },
        ],
        args: ItemBoundArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.ERC1155RoyaltiesSoulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_UPGRADABLE_NAME.Items,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: [CONTRACT_UPGRADABLE_NAME.Avatars],
        functionCalls: [
            {
                contractName: CONTRACT_UPGRADABLE_NAME.Items,
                functionName: 'grantRole',
                args: ['MINTER_ROLE', `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Avatars}`],
            },
            {
                contractName: CONTRACT_UPGRADABLE_NAME.Items,
                functionName: 'grantRole',
                args: ['MINTER_ROLE', `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Levels}`],
            },
        ],
        args: ItemBoundArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.Levels,
        type: CONTRACT_TYPE.Levels,
        name: CONTRACT_NAME.Levels,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.Items, CONTRACT_NAME.Avatars],
        args: LevelsBoundArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Levels,
        type: CONTRACT_TYPE.Levels,
        name: CONTRACT_NAME.Levels,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: [CONTRACT_UPGRADABLE_NAME.Items, CONTRACT_UPGRADABLE_NAME.Avatars],
        args: LevelsBoundV1Args.TESTNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.FreeMint,
        type: CONTRACT_TYPE.FreeMint,
        name: CONTRACT_NAME.FreeMint,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_UPGRADABLE_NAME.Avatars],
        functionCalls: [
            {
                contractName: CONTRACT_NAME.FreeMint,
                functionName: 'grantRole',
                args: ['MINTER_ROLE', `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Avatars}`],
            },
        ],
        args: OpenMintArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.ERC20PythPaymaster,
        type: CONTRACT_TYPE.Paymaster,
        name: CONTRACT_NAME.PaymasterPyth,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        // dependencies: ['AvatarBoundV1'],
        // functionCalls: [
        //     {
        //         contractName: CONTRACT_NAME.PaymasterPyth,
        //         functionName: 'addRecipient',
        //         args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Avatars}`],
        //     },
        //     {
        //         contractName: CONTRACT_NAME.PaymasterPyth,
        //         functionName: 'addRecipient',
        //         args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`],
        //     },
        //     {
        //         contractName: CONTRACT_NAME.PaymasterPyth,
        //         functionName: 'addRecipient',
        //         args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Levels}`],
        //     },
        // ],
    },
    {
        contractFileName: CONTRACT_FILE_NAME.ERC20ChainlinkPaymaster,
        type: CONTRACT_TYPE.Paymaster,
        name: CONTRACT_NAME.PaymasterChainlink,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: [
            CONTRACT_UPGRADABLE_NAME.Avatars,
            CONTRACT_UPGRADABLE_NAME.Items,
            CONTRACT_UPGRADABLE_NAME.Levels,
        ],
        functionCalls: [
            {
                contractName: CONTRACT_NAME.PaymasterChainlink,
                functionName: 'addRecipient',
                args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Avatars}`],
            },
            {
                contractName: CONTRACT_NAME.PaymasterChainlink,
                functionName: 'addRecipient',
                args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`],
            },
            {
                contractName: CONTRACT_NAME.PaymasterChainlink,
                functionName: 'addRecipient',
                args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Levels}`],
            },
        ],
        args: ERC20ChainlinkPaymasterArgs.TESTNET,
    },
];
