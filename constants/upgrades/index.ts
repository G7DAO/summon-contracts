// import { ZKSYNC_SEPOLIA_CONTRACTS } from './upgrades-zksync-sepolia';

// export const CONTRACTS = [...ZKSYNC_SEPOLIA_CONTRACTS];

import { CONTRACT_TYPE } from '@constants/contract';
import { TENANT } from '@constants/tenant';
import { DeploymentContract } from '../../types/deployment-type'; // Adjust path if your types are elsewhere
import { NETWORK_TYPE, NetworkName } from '../network';

/**
 * IMPORTANT:
 * - Update the placeholder values below with your actual contract details.
 * - Ensure the `chain` matches the network name you use with Hardhat (e.g., 'arbitrumSepolia').
 * - The `version` should be the NEW version number you are upgrading TO.
 * - The `proxyAddress` is the address of the existing proxy contract you want to upgrade.
 * - `contractFileName` is the name of the .sol file for the NEW implementation (without .sol).
 */
export const CONTRACTS: DeploymentContract[] = [
    {
        name: 'GUnits', // Logical name used in the --name parameter of the upgrade task
        contractFileName: 'GUnits', // The .sol file name of the NEW GUnits implementation (e.g., GUnitsV2 if different)
        type: CONTRACT_TYPE.GUnits, // Replace with your actual CONTRACT_TYPE if available and applicable
        chain: NetworkName.ArbitrumSepolia, // << UPDATE THIS: e.g., 'arbitrumSepolia', 'mainnet', 'sepolia'
        networkType: NETWORK_TYPE.TESTNET, // << UPDATE THIS: Your NETWORK_TYPE if applicable
        version: 2, // << UPDATE THIS: The NEW version number this configuration represents
        tenants: [TENANT.Game7], // << UPDATE THIS: Array of applicable TENANTs. Cast as any if TENANT is a complex type not imported.
        upgradable: true,
        proxyAddress: '0x3E95CB707F2274e91Cd643f445128818304eD4B5', // << From your example
        verify: true,
        args: {},
        dependencies: [],
        functionCalls: [],
    },
    {
        name: 'GUnits', // Logical name used in the --name parameter of the upgrade task
        contractFileName: 'GUnits', // The .sol file name of the NEW GUnits implementation (e.g., GUnitsV2 if different)
        type: CONTRACT_TYPE.GUnits, // Replace with your actual CONTRACT_TYPE if available and applicable
        chain: NetworkName.ArbitrumOne, // << UPDATE THIS: e.g., 'arbitrumSepolia', 'mainnet', 'sepolia'
        networkType: NETWORK_TYPE.MAINNET, // << UPDATE THIS: Your NETWORK_TYPE if applicable
        version: 2, // << UPDATE THIS: The NEW version number this configuration represents
        tenants: [TENANT.Game7], // << UPDATE THIS: Array of applicable TENANTs. Cast as any if TENANT is a complex type not imported.
        upgradable: true,
        proxyAddress: '0xd5613B0B45baad0547fA70A9d65A91622e776B11', // << From your example
        verify: true,
        args: {},
        dependencies: [],
        functionCalls: [],
    },
    {
        name: 'GReceipts', // Logical name used in the --name parameter of the upgrade task
        contractFileName: 'GReceipts', // The .sol file name of the NEW GUnits implementation (e.g., GUnitsV2 if different)
        type: CONTRACT_TYPE.GReceipts, // Replace with your actual CONTRACT_TYPE if available and applicable
        chain: NetworkName.ArbitrumOne, // << UPDATE THIS: e.g., 'arbitrumSepolia', 'mainnet', 'sepolia'
        networkType: NETWORK_TYPE.MAINNET, // << UPDATE THIS: Your NETWORK_TYPE if applicable
        version: 1, // << UPDATE THIS: The NEW version number this configuration represents
        tenants: [TENANT.Game7], // << UPDATE THIS: Array of applicable TENANTs. Cast as any if TENANT is a complex type not imported.
        upgradable: true,
        proxyAddress: '0x6Bdecc2f78A911D5b166ce111cCd8b0e2703cE57', // << From your example
        verify: true,
        args: {},
        dependencies: [],
        functionCalls: [],
    },
    // Add configurations for other contracts or other versions you might want to upgrade
];

export const ACHIEVO_TMP_DIR = '.achievo';
export const ABI_PATH = 'artifacts/contracts/';
