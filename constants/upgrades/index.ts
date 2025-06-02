// import { ZKSYNC_SEPOLIA_CONTRACTS } from './upgrades-zksync-sepolia';

// export const CONTRACTS = [...ZKSYNC_SEPOLIA_CONTRACTS];

import { DeploymentContract } from '../../types/deployment-type'; // Adjust path if your types are elsewhere

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
        type: 'GameUnits' as any, // Replace with your actual CONTRACT_TYPE if available and applicable
        chain: 'arbitrumSepolia', // << UPDATE THIS: e.g., 'arbitrumSepolia', 'mainnet', 'sepolia'
        networkType: 'L2' as any, // << UPDATE THIS: Your NETWORK_TYPE if applicable
        version: 2, // << UPDATE THIS: The NEW version number this configuration represents
        tenants: ['achievo' as any], // << UPDATE THIS: Array of applicable TENANTs. Cast as any if TENANT is a complex type not imported.
        upgradable: true,
        proxyAddress: '0x3E95CB707F2274e91Cd643f445128818304eD4B5', // << From your example
        verify: true,
        args: {
            // Example: If your new GUnitsV2#initialize function (or reinitializer) takes arguments:
            // initialOwner: "DEPLOYER_WALLET",
            // someValue: 123,
        },
        dependencies: [],
        // functionCalls: [
        //   {
        //     contractName: "GUnits", // Should match `name` or refer to the contract being called
        //     functionName: "newFunctionInV2",
        //     args: ["someArgForNewFunction"],
        //   },
        // ],
    },
    // Add configurations for other contracts or other versions you might want to upgrade
];

export const ACHIEVO_TMP_DIR = '.achievo';
export const ABI_PATH = 'artifacts/contracts/';
