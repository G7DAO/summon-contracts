import {
    AvatarBoundArgs,
    AvatarBoundV1Args,
    ERC20Args,
    ItemBoundArgs,
    LevelsBoundArgs,
    LevelsBoundV1Args,
    MarketplaceArgs,
    OpenMintArgs,
} from '@constants/constructor-args';
import {
    CONTRACT_TYPE,
    CONTRACT_NAME,
    CONTRACT_UPGRADABLE_NAME,
    CONTRACT_FILE_NAME,
    CONTRACT_UPGRADABLE_FILE_NAME,
} from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.Game7Testnet;
const networkType = NETWORK_TYPE.TESTNET;

export const G7_TESTNET_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.Avatars,
        type: CONTRACT_TYPE.Avatars,
        name: CONTRACT_NAME.Avatars,
        chain,
        networkType,
        tenants: [TENANT.Game7],
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
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: true,
        dependencies: [CONTRACT_UPGRADABLE_NAME.Items, CONTRACT_UPGRADABLE_NAME.Levels],
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
        tenants: [TENANT.Game7],
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
        tenants: [TENANT.IronWorks],
        verify: true,
        upgradable: true,
        dependencies: [],
        // dependencies: [CONTRACT_UPGRADABLE_NAME.Avatars],
        // functionCalls: [
        //     {
        //         contractName: CONTRACT_UPGRADABLE_NAME.Items,
        //         functionName: 'grantRole',
        //         args: ['MINTER_ROLE', `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Avatars}`],
        //     },
        //     {
        //         contractName: CONTRACT_UPGRADABLE_NAME.Items,
        //         functionName: 'grantRole',
        //         args: ['MINTER_ROLE', `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Levels}`],
        //     },
        // ],
        args: ItemBoundArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.ERC1155Soulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_NAME.Items,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        verify: false,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: ItemBoundArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.ERC1155RoyaltiesSoulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_UPGRADABLE_NAME.ItemsRoyaltiesV2,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        verify: false,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: ItemBoundArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.Levels,
        type: CONTRACT_TYPE.Levels,
        name: CONTRACT_NAME.Levels,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.Items, CONTRACT_NAME.Avatars],
        args: LevelsBoundArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Levels,
        type: CONTRACT_TYPE.Levels,
        name: CONTRACT_UPGRADABLE_NAME.Levels,
        chain,
        networkType,
        tenants: [TENANT.Game7],
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
        tenants: [TENANT.IronWorks],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: OpenMintArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.Martins,
        type: CONTRACT_TYPE.ERC20,
        name: CONTRACT_NAME.MartinsToken,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: ERC20Args.TESTNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_NAME.Marketplace,
        type: CONTRACT_TYPE.Marketplace,
        name: CONTRACT_UPGRADABLE_NAME.Marketplace,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.DirectListingExtension, CONTRACT_UPGRADABLE_FILE_NAME.ERC1155RoyaltiesSoulbound],
        functionCalls: [],
        args: MarketplaceArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_NAME.Staker,
        type: CONTRACT_TYPE.Staker,
        name: CONTRACT_UPGRADABLE_NAME.Staker,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: MarketplaceArgs.TESTNET,
    },
];
