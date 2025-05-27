import { GUnitsArgs, ERC20DecimalsAgs } from '@constants/constructor-args';
import {
    CONTRACT_NAME,
    CONTRACT_TYPE,
    CONTRACT_UPGRADABLE_FILE_NAME,
    CONTRACT_UPGRADABLE_NAME,
} from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.ArbitrumSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const ARBITRUM_SEPOLIA_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.GUnits,
        type: CONTRACT_TYPE.GUnits,
        name: CONTRACT_NAME.GUnits,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [
            {
                contractName: CONTRACT_NAME.GUnits,
                functionName: 'initialize',
                args: [
                    GUnitsArgs.ARBITRUM_SEPOLIA._token,
                    GUnitsArgs.ARBITRUM_SEPOLIA._isPaused,
                    GUnitsArgs.ARBITRUM_SEPOLIA._devWallet
                ],
            },
        ],
        args: [
            GUnitsArgs.ARBITRUM_SEPOLIA._token,
            GUnitsArgs.ARBITRUM_SEPOLIA._isPaused,
            GUnitsArgs.ARBITRUM_SEPOLIA._devWallet
        ],
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.MockUSDC,
        type: CONTRACT_TYPE.MockUSDC,
        name: CONTRACT_NAME.MockUSDC,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: [
            'Karacurt USDC',
            'kUSDC',
            6,
        ],
    },
];
