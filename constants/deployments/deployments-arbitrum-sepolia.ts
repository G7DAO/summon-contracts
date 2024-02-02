import { CONTRACT_UPGRADABLE_FILE_NAME, CONTRACT_UPGRADABLE_NAME, CONTRACT_TYPE } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';
import { BadgeBoundArgs, ItemBoundAzerothArgs } from '@constants/constructor-args';

const chain = NetworkName.ArbitrumSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const ARBITRUM_SEPOLIA_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.ERC1155Soulbound,
        type: CONTRACT_TYPE.Items,
        name: CONTRACT_UPGRADABLE_NAME.Items,
        chain,
        networkType,
        tenants: [TENANT.Azeroth],
        verify: false,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: ItemBoundAzerothArgs.MAINNET,
    },
];
