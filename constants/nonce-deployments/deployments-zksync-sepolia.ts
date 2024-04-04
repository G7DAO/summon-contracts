import { HelloWorldArgs, LootDropHQArgs } from '@constants/constructor-args';
import { CONTRACT_TYPE, CONTRACT_NAME, CONTRACT_FILE_NAME } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.ZkSyncSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const ZKSYNC_SEPOLIA_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.LootDropHQ,
        type: CONTRACT_TYPE.LootDropHQ,
        name: CONTRACT_NAME.LootDropHQ,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: LootDropHQArgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.HelloWorld,
        type: CONTRACT_TYPE.HelloWorld,
        name: CONTRACT_NAME.HelloWorld,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: HelloWorldArgs.TESTNET,
    },
];
