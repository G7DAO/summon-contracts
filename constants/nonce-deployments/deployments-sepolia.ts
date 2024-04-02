import { HelloWorldArgs, LootDropArgs } from '@constants/constructor-args';
import { CONTRACT_FILE_NAME, CONTRACT_NAME, CONTRACT_TYPE } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.Sepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const SEPOLIA_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.LootDrop,
        type: CONTRACT_TYPE.LootDrop,
        name: CONTRACT_NAME.LootDrop,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: LootDropArgs.TESTNET,
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