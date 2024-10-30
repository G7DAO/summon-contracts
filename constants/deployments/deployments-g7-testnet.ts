import {
    AccessTokenG7Args,
    AvatarBoundV1Args,
    ItemBoundArgs,
    LevelsBoundV1Args,
    RewardsNativeG7Args,
} from '@constants/constructor-args';
import {
    CONTRACT_TYPE,
    CONTRACT_UPGRADABLE_NAME,
    CONTRACT_UPGRADABLE_FILE_NAME,
    CONTRACT_FILE_NAME,
    CONTRACT_NAME,
} from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.Game7Testnet;
const networkType = NETWORK_TYPE.TESTNET;

export const G7_TESTNET_CONTRACTS: DeploymentContract[] = [
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
        contractFileName: CONTRACT_FILE_NAME.AccessToken,
        type: CONTRACT_TYPE.RewardAccessToken,
        name: CONTRACT_NAME.RewardAccessTokenG7,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [
            {
                contractName: CONTRACT_NAME.RewardAccessTokenG7,
                functionName: 'initialize',
                args: [
                    'AccessToken',
                    'AT',
                    'NO_VALUE',
                    'NO_VALUE',
                    'DEPLOYER_WALLET',
                    /* this should be the minterContract -> RewardsNativeG7 */ 'MINTER_ROLE',
                ],
            },
        ],
        args: AccessTokenG7Args.TESTNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.RewardsNative,
        type: CONTRACT_TYPE.Rewards,
        name: CONTRACT_NAME.RewardsNativeG7,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.RewardAccessTokenG7],
        functionCalls: [],
        args: RewardsNativeG7Args.TESTNET,
    },
];
