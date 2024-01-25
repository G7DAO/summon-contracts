import { CONTRACT_TYPE } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.MantleWadsley;
const networkType = NETWORK_TYPE.TESTNET;

export const MANTLE_WADSLEY_CONTRACTS: DeploymentContract[] = [
    {
        contractName: 'GameSummary',
        type: CONTRACT_TYPE.GameSummary,
        name: CONTRACT_TYPE.GameSummary,
        chain,
        networkType,
        tenants: [TENANT.HyperPlay],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
    },
];
