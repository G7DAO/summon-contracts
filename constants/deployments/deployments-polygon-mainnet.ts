import { StakerV1Args } from '@constants/constructor-args';
import { CONTRACT_UPGRADABLE_FILE_NAME, CONTRACT_UPGRADABLE_NAME, CONTRACT_TYPE } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.Polygon;
const networkType = NETWORK_TYPE.MAINNET;

export const POLYGON_MAINNET_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Staker,
        type: CONTRACT_TYPE.Staker,
        name: CONTRACT_UPGRADABLE_NAME.Staker,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: StakerV1Args.MAINNET,
    },
];
