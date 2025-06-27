import { CONTRACT_NAME, CONTRACT_TYPE, CONTRACT_UPGRADABLE_FILE_NAME } from '@constants/contract';
import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';
import { TENANT } from '@constants/tenant';
import { GReceiptsArgs, GUnitsArgs } from '@constants/constructor-args';

const chain = NetworkName.ArbitrumOne;
const networkType = NETWORK_TYPE.MAINNET;

export const ARBITRUM_ONE_CONTRACTS: DeploymentContract[] = [
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
                    GUnitsArgs.ARBITRUM_ONE._token,
                    GUnitsArgs.ARBITRUM_ONE._isPaused,
                    GUnitsArgs.ARBITRUM_ONE._devWallet
                ],
            },
        ],
        args: [
            GUnitsArgs.ARBITRUM_ONE._token,
            GUnitsArgs.ARBITRUM_ONE._isPaused,
            GUnitsArgs.ARBITRUM_ONE._devWallet
        ],
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.GReceipts,
        type: CONTRACT_TYPE.GReceipts,
        name: CONTRACT_NAME.GReceipts,
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
                    GReceiptsArgs.ARBITRUM_SEPOLIA._gUnits,
                    GReceiptsArgs.ARBITRUM_SEPOLIA._paymentToken,
                    GReceiptsArgs.ARBITRUM_SEPOLIA._isPaused,
                    GReceiptsArgs.ARBITRUM_SEPOLIA._devWallet,
                ],
            },
        ],
        args: [
            GReceiptsArgs.ARBITRUM_SEPOLIA._gUnits,
            GReceiptsArgs.ARBITRUM_SEPOLIA._paymentToken,
            GReceiptsArgs.ARBITRUM_SEPOLIA._isPaused,
            GReceiptsArgs.ARBITRUM_SEPOLIA._devWallet,
        ],
    }
];
