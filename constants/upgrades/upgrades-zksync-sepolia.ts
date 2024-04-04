import {
    AvatarBoundV1Args,
    BadgeBoundArgs,
    ERC20ChainlinkPaymasterArgs,
    ItemBoundArgs,
    LevelsBoundV1Args,
} from '@constants/constructor-args';
import {
    CONTRACT_TYPE,
    CONTRACT_NAME,
    CONTRACT_UPGRADABLE_NAME,
    CONTRACT_UPGRADABLE_FILE_NAME_V2,
} from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.ZkSyncSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const ZKSYNC_SEPOLIA_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME_V2.Avatars,
        type: CONTRACT_TYPE.Avatars,
        name: CONTRACT_UPGRADABLE_NAME.Avatars,
        version: 2,
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
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME_V2.ERC1155RoyaltiesSoulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_UPGRADABLE_NAME.Items,
        version: 2,
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
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME_V2.Levels,
        type: CONTRACT_TYPE.Levels,
        name: CONTRACT_NAME.Levels,
        version: 2,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: [CONTRACT_UPGRADABLE_NAME.Items, CONTRACT_UPGRADABLE_NAME.Avatars],
        args: LevelsBoundV1Args.TESTNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME_V2.ERC20ChainlinkPaymaster,
        type: CONTRACT_TYPE.Paymaster,
        name: CONTRACT_UPGRADABLE_NAME.PaymasterChainlink,
        version: 2,
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
                contractName: CONTRACT_UPGRADABLE_NAME.PaymasterChainlink,
                functionName: 'addRecipient',
                args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Avatars}`],
            },
            {
                contractName: CONTRACT_UPGRADABLE_NAME.PaymasterChainlink,
                functionName: 'addRecipient',
                args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`],
            },
            {
                contractName: CONTRACT_UPGRADABLE_NAME.PaymasterChainlink,
                functionName: 'addRecipient',
                args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Levels}`],
            },
        ],
        args: ERC20ChainlinkPaymasterArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME_V2.ERC1155Soulbound,
        type: CONTRACT_TYPE.Badge,
        name: CONTRACT_UPGRADABLE_NAME.Badge,
        version: 2,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: BadgeBoundArgs.TESTNET,
    },
];
