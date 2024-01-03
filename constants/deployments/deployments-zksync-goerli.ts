import { DeploymentContract } from '../../types/deployment-type';
import { TENANT, CONTRACT_TYPE } from '../constructor-args';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.ZkSyncGoerli;
const networkType = NETWORK_TYPE.TESTNET;

export const ZKSYNC_GOERLI_CONTRACTS: DeploymentContract[] = [
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
        dependencies: ['OpenMint', 'ItemBoundV1', 'LevelsBoundV1'],
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
        dependencies: ['AvatarBoundV1'],
        functionCalls: [
            {
                contractName: 'ItemBoundV1',
                functionName: 'grantRole',
                args: ['MINTER_ROLE', 'CONTRACT_AvatarBoundV1'],
            },
            {
                contractName: 'ItemBoundV1',
                functionName: 'grantRole',
                args: ['MINTER_ROLE', 'CONTRACT_LevelsBoundV1'],
            },
        ],
    },
    {
        contractName: 'ItemsRewardBound',
        type: CONTRACT_TYPE.RewardItems,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [
            {
                contractName: 'ItemsRewardBound',
                functionName: 'addNewTokens',
                args: [
                    [
                        {
                            tokenId: 1,
                            rewardAmount: 0,
                            rewardERC20: '',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmT86CwHwRzUh9zBj6qvDB7P2Gn2wUK6BnJrn2RzESq3e3',
                        },
                        {
                            tokenId: 2,
                            rewardAmount: 250000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice2.svg',
                        },
                        {
                            tokenId: 3,
                            rewardAmount: 150000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice3.svg',
                        },
                        {
                            tokenId: 4,
                            rewardAmount: 100000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice4.svg',
                        },
                        {
                            tokenId: 5,
                            rewardAmount: 75000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice5.svg',
                        },
                        {
                            tokenId: 6,
                            rewardAmount: 50000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice6.svg',
                        },
                        {
                            tokenId: 7,
                            rewardAmount: 25000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice7.svg',
                        },
                        {
                            tokenId: 8,
                            rewardAmount: 50000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice8.svg',
                        },
                        {
                            tokenId: 9,
                            rewardAmount: 75000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice9.svg',
                        },
                        {
                            tokenId: 10,
                            rewardAmount: 100000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice10.svg',
                        },
                        {
                            tokenId: 11,
                            rewardAmount: 150000000000000000000,
                            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
                            isEther: false,
                            tokenUri:
                                'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice11.svg',
                        },
                        {
                            tokenId: 12,
                            rewardAmount: 200000000000000000000,
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
    {
        contractName: 'OpenMint',
        type: CONTRACT_TYPE.OpenMint,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: ['AvatarBoundV1'],
        functionCalls: [
            {
                contractName: 'OpenMint',
                functionName: 'grantRole',
                args: ['MINTER_ROLE', 'CONTRACT_AvatarBoundV1'],
            },
        ],
    },
    {
        contractName: 'ERC20PythPaymaster',
        type: CONTRACT_TYPE.Paymaster,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: ['AvatarBoundV1'],
        functionCalls: [
            {
                contractName: 'ERC20PythPaymaster',
                functionName: 'addRecipient',
                args: ['CONTRACT_AvatarBoundV1'],
            },
            {
                contractName: 'ERC20PythPaymaster',
                functionName: 'addRecipient',
                args: ['CONTRACT_ItemBoundV1'],
            },
            {
                contractName: 'ERC20PythPaymaster',
                functionName: 'addRecipient',
                args: ['CONTRACT_LevelsBoundV1'],
            },
        ],
    },
    {
        contractName: 'ERC20ChainlinkPaymaster',
        type: CONTRACT_TYPE.Paymaster,
        chain,
        networkType,
        tenants: [TENANT.ZkSync],
        verify: true,
        upgradable: false,
        dependencies: ['AvatarBoundV1'],
        functionCalls: [
            {
                contractName: 'ERC20ChainlinkPaymaster',
                functionName: 'addRecipient',
                args: ['CONTRACT_AvatarBoundV1'],
            },
            {
                contractName: 'ERC20ChainlinkPaymaster',
                functionName: 'addRecipient',
                args: ['CONTRACT_ItemBoundV1'],
            },
            {
                contractName: 'ERC20ChainlinkPaymaster',
                functionName: 'addRecipient',
                args: ['CONTRACT_LevelsBoundV1'],
            },
        ],
    },
];
