import {
    AvatarBoundArgs,
    AvatarBoundV1Args,
    BadgeBoundArgs,
    BridgeZkSyncV1Args,
    BurnableTokenV1Args,
    ERC20ChainlinkPaymasterArgs,
    ERC20PythPaymasterArgs,
    ItemBoundArgs,
    ItemsRewardBoundArgs,
    LevelsBoundArgs,
    LevelsBoundV1Args,
    LootDropArgs,
    OpenMintArgs,
    RewardTokenArgs,
    WhitelistArgs,
    ZKSSPorkV1Args,
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

const chain = NetworkName.ZkSync;
const networkType = NETWORK_TYPE.MAINNET;

export const ZKSYNC_MAINNET_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.Avatars,
        type: CONTRACT_TYPE.Avatars,
        name: CONTRACT_NAME.Avatars,
        chain,
        networkType,
        tenants: [TENANT.ZkSync, TENANT.Game7],
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
        args: AvatarBoundArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Avatars,
        type: CONTRACT_TYPE.Avatars,
        name: CONTRACT_UPGRADABLE_NAME.Avatars,
        chain,
        networkType,
        tenants: [TENANT.ZkSync, TENANT.Game7],
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
        args: AvatarBoundV1Args.MAINNET,
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
        args: ItemBoundArgs.MAINNET,
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
        args: ItemBoundArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.ERC1155RewardSoulbound,
        type: CONTRACT_TYPE.RewardItems,
        name: CONTRACT_NAME.RewardItems,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [
            {
                contractName: CONTRACT_NAME.RewardItems,
                functionName: 'addNewTokens',
                args: [
                    [
                        {
                            tokenId: 1,
                            rewardAmount: 0,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmT86CwHwRzUh9zBj6qvDB7P2Gn2wUK6BnJrn2RzESq3e3',
                        },
                        {
                            tokenId: 2,
                            rewardAmount: 250,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice2.svg',
                        },
                        {
                            tokenId: 3,
                            rewardAmount: 150,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice3.svg',
                        },
                        {
                            tokenId: 4,
                            rewardAmount: 100,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice4.svg',
                        },
                        {
                            tokenId: 5,
                            rewardAmount: 75,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice5.svg',
                        },
                        {
                            tokenId: 6,
                            rewardAmount: 50,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice6.svg',
                        },
                        {
                            tokenId: 7,
                            rewardAmount: 25,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice7.svg',
                        },
                        {
                            tokenId: 8,
                            rewardAmount: 50,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice8.svg',
                        },
                        {
                            tokenId: 9,
                            rewardAmount: 75,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice9.svg',
                        },
                        {
                            tokenId: 10,
                            rewardAmount: 100,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice10.svg',
                        },
                        {
                            tokenId: 11,
                            rewardAmount: 150,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice11.svg',
                        },
                        {
                            tokenId: 12,
                            rewardAmount: 200,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice12.svg',
                        },
                    ],
                ],
                contractAddress: '0x7A82a6944c41AC8b8f15DE40A08967c5cF979881',
            },
        ],
        args: ItemsRewardBoundArgs.MAINNET,
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
        args: LevelsBoundArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Levels,
        type: CONTRACT_TYPE.Levels,
        name: CONTRACT_UPGRADABLE_NAME.Levels,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: true,
        dependencies: [CONTRACT_UPGRADABLE_NAME.Items, CONTRACT_UPGRADABLE_NAME.Avatars],
        args: LevelsBoundV1Args.MAINNET,
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
        args: OpenMintArgs.MAINNET,
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
        dependencies: [
            CONTRACT_UPGRADABLE_NAME.Avatars,
            CONTRACT_UPGRADABLE_NAME.Items,
            CONTRACT_UPGRADABLE_NAME.Levels,
        ],
        functionCalls: [
            {
                contractName: CONTRACT_NAME.PaymasterPyth,
                functionName: 'addRecipient',
                args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Avatars}`],
            },
            {
                contractName: CONTRACT_NAME.PaymasterPyth,
                functionName: 'addRecipient',
                args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`],
            },
            {
                contractName: CONTRACT_NAME.PaymasterPyth,
                functionName: 'addRecipient',
                args: [`CONTRACT_${CONTRACT_UPGRADABLE_NAME.Levels}`],
            },
        ],
        args: ERC20PythPaymasterArgs.MAINNET,
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
        args: ERC20ChainlinkPaymasterArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.ERC20ChainlinkPaymaster,
        type: CONTRACT_TYPE.Paymaster,
        name: CONTRACT_UPGRADABLE_NAME.PaymasterChainlink,
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
        args: ERC20ChainlinkPaymasterArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.ERC1155Soulbound,
        type: CONTRACT_TYPE.Badge,
        name: CONTRACT_NAME.Badge,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: BadgeBoundArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.ERC1155Soulbound,
        type: CONTRACT_TYPE.Badge,
        name: CONTRACT_UPGRADABLE_NAME.Badge,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: BadgeBoundArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Bridge,
        type: CONTRACT_TYPE.Bridge,
        name: CONTRACT_UPGRADABLE_NAME.BridgeZkSync,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: BridgeZkSyncV1Args.MAINNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.BurnableToken,
        type: CONTRACT_TYPE.Token,
        name: CONTRACT_UPGRADABLE_NAME.ZkSpork,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: BurnableTokenV1Args.MAINNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.Whitelist,
        type: CONTRACT_TYPE.Whitelist,
        name: CONTRACT_NAME.Whitelist,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: WhitelistArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Staker,
        type: CONTRACT_TYPE.Staker,
        name: CONTRACT_UPGRADABLE_NAME.Staker,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: ZKSSPorkV1Args.MAINNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.LootDrop,
        type: CONTRACT_TYPE.LootDrop,
        name: CONTRACT_NAME.LootDrop,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.RewardToken],
        functionCalls: [],
        args: LootDropArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.AdminERC1155Soulbound,
        type: CONTRACT_TYPE.RewardToken,
        name: CONTRACT_NAME.RewardToken,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.LootDrop],
        functionCalls: [],
        args: RewardTokenArgs.MAINNET,
    },
];
