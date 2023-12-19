import { DeploymentContract } from '../../types/deployment-type';
import { TENANT, CONTRACT_TYPE } from '../constructor-args';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.MantleWadsley;
const networkType = NETWORK_TYPE.TESTNET;

export const MANTLE_WADSLEY_CONTRACTS: DeploymentContract[] = [
    {
        contractName: 'GameSummary',
        type: CONTRACT_TYPE.GameSummary,
        chain,
        networkType,
        tenants: [TENANT.HyperPlay],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
    },
];
