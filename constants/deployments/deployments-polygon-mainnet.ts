import { BridgePolygonV1Args, StakerV1Args } from '@constants/constructor-args';
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
    {
        contractFileName: CONTRACT_FILE_NAME.Bridge,
        type: CONTRACT_TYPE.Bridge,
        name: CONTRACT_NAME.Bridge,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: false,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: BridgePolygonV1Args.MAINNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Bridge,
        type: CONTRACT_TYPE.Bridge,
        name: CONTRACT_UPGRADABLE_NAME.BridgePolygon,
        chain,
        networkType,
        tenants: [TENANT.ETHDenver],
        verify: false,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: BridgePolygonV1Args.MAINNET,
    },
];
