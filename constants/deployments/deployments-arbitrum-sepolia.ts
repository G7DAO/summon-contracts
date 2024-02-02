import { CONTRACT_UPGRADABLE_FILE_NAME, CONTRACT_UPGRADABLE_NAME, CONTRACT_TYPE } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';
import { BadgeBoundArgs } from '@constants/constructor-args';

const chain = NetworkName.ArbitrumSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const ARBITRUM_SEPOLIA_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.ERC1155Soulbound,
        type: CONTRACT_TYPE.Badge,
        name: CONTRACT_UPGRADABLE_NAME.Badge,
        chain,
        networkType,
        tenants: [TENANT.Azeroth],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: BadgeBoundArgs.TESTNET,
    },
];
