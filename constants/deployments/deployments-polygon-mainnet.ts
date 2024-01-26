import { DeploymentContract } from '../../types/deployment-type';
import { TENANT, CONTRACT_TYPE } from '../constructor-args';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.Polygon;
const networkType = NETWORK_TYPE.MAINNET;

export const POLYGON_MAINNET_CONTRACTS: DeploymentContract[] = [
    {
        contractName: 'StakerV1',
        type: CONTRACT_TYPE.Staker,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
    },
];
