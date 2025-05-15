import { ChipsArgs, ERC20DecimalsAgs } from '@constants/constructor-args';
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
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.BurnableToken,
        type: CONTRACT_TYPE.ERC20,
        name: CONTRACT_UPGRADABLE_NAME.ERC20,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        verify: false,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: ERC20DecimalsAgs.TESTNET,
    },
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.Chips,
        type: CONTRACT_TYPE.Chips,
        name: CONTRACT_NAME.Chips,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: true,
        dependencies: [],
        functionCalls: [
            {
                contractName: CONTRACT_NAME.Chips,
                functionName: 'initialize',
                args: [
                    ChipsArgs.ARBITRUM_SEPOLIA._token,
                    ChipsArgs.ARBITRUM_SEPOLIA._isPaused,
                    ChipsArgs.ARBITRUM_SEPOLIA._devWallet
                ],
            },
        ],
        args: [
            ChipsArgs.ARBITRUM_SEPOLIA._token,
            ChipsArgs.ARBITRUM_SEPOLIA._isPaused,
            ChipsArgs.ARBITRUM_SEPOLIA._devWallet
        ],
    },
];
