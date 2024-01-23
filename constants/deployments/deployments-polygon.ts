import { DeploymentContract } from '../../types/deployment-type';
import { TENANT, CONTRACT_TYPE } from '../constructor-args';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.MantleWadsley;
const networkType = NETWORK_TYPE.TESTNET;

export const POLYGON_MUMBAI_CONTRACTS: DeploymentContract[] = [
    {
        contractName: 'StakerSwapV1',
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