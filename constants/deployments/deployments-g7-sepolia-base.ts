import { ERC20Args, ItemBoundArgs, OpenMintArgs } from '@constants/constructor-args';
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

const chain = NetworkName.ZkSyncSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const G7_SEPOLIA_BASE_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.ERC1155RoyaltiesSoulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_NAME.Items,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: ItemBoundArgs.TESTNET,
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
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.ERC1155RoyaltiesSoulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_UPGRADABLE_NAME.Items,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: ItemBoundArgs.TESTNET,
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
];
