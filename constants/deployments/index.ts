import { ARBITRUM_ONE_CONTRACTS } from '@constants/deployments/deployments-arbitrum-one';
import { ARBITRUM_SEPOLIA_CONTRACTS } from '@constants/deployments/deployments-arbitrum-sepolia';

import { MANTLE_SEPOLIA_CONTRACTS } from './deployments-mantle-sepolia';
import { POLYGON_MAINNET_CONTRACTS } from './deployments-polygon-mainnet';
import { POLYGON_MUMBAI_CONTRACTS } from './deployments-polygon-mumbai';
import { SEPOLIA_CONTRACTS } from './deployments-sepolia';
import { ZKSYNC_MAINNET_CONTRACTS } from './deployments-zksync-mainnet';
import { ZKSYNC_SEPOLIA_CONTRACTS } from './deployments-zksync-sepolia';
import { BASE_SEPOLIA_CONTRACTS } from '@constants/deployments/deployments-base-sepolia';
import { G7_SEPOLIA_BASE_CONTRACTS } from '@constants/deployments/deployments-g7-sepolia-base';
import { G7_SEPOLIA_ARB_CONTRACTS } from '@constants/deployments/deployments-g7-sepolia-arb';

export const CONTRACTS = [
    ...G7_SEPOLIA_ARB_CONTRACTS,
    ...G7_SEPOLIA_BASE_CONTRACTS,
    ...ARBITRUM_ONE_CONTRACTS,
    ...BASE_SEPOLIA_CONTRACTS,
    ...ARBITRUM_SEPOLIA_CONTRACTS,
    ...POLYGON_MAINNET_CONTRACTS,
    ...POLYGON_MUMBAI_CONTRACTS,
    ...ZKSYNC_MAINNET_CONTRACTS,
    ...ZKSYNC_SEPOLIA_CONTRACTS,
    ...SEPOLIA_CONTRACTS,
    ...MANTLE_SEPOLIA_CONTRACTS,
];

export const ACHIEVO_TMP_DIR = '.achievo';
export const ABI_PATH_ZK = 'artifacts-zk/contracts/';
export const ABI_PATH = 'artifacts/contracts/';
