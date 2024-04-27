import {
    BUIDLArgs,
    ERC20Args,
    ItemBoundArgs,
    ItemBoundIronWorksArgs,
    MarketplaceArgs,
    OpenMintArgs,
    RewardTokenArgs,
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

const chain = NetworkName.Game7OrbitARBOneSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const G7_SEPOLIA_ARB_CONTRACTS: DeploymentContract[] = [
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
        args: ItemBoundIronWorksArgs.MAINNET,
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
        contractFileName: CONTRACT_FILE_NAME.ERC20,
        type: CONTRACT_TYPE.ERC20,
        name: CONTRACT_NAME.MartinERC20,
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
];
