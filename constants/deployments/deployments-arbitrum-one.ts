import {
    CONTRACT_UPGRADABLE_FILE_NAME,
    CONTRACT_UPGRADABLE_NAME,
    CONTRACT_TYPE,
    CONTRACT_FILE_NAME,
    CONTRACT_NAME,
} from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';
import { BadgeBoundArgs } from '@constants/constructor-args';

const chain = NetworkName.ArbitrumOne;
const networkType = NETWORK_TYPE.MAINNET;

export const ARBITRUM_ONE_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.ERC1155Soulbound,
        type: CONTRACT_TYPE.Badge,
        name: CONTRACT_NAME.Badge,
        chain,
        networkType,
        tenants: [TENANT.Azeroth],
        verify: false,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: BadgeBoundArgs.TESTNET,
    },
];
