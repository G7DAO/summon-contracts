import { ARBITRUM_ONE_CONTRACTS } from '@constants/deployments/deployments-arbitrum-one';
import { ARBITRUM_SEPOLIA_CONTRACTS } from '@constants/deployments/deployments-arbitrum-sepolia';
import { BASE_SEPOLIA_CONTRACTS } from '@constants/deployments/deployments-base-sepolia';
import { G7_TESTNET_CONTRACTS } from '@constants/deployments/deployments-g7-testnet';

import { POLYGON_MAINNET_CONTRACTS } from './deployments-polygon-mainnet';
import { POLYGON_MUMBAI_CONTRACTS } from './deployments-polygon-mumbai';
import { SEPOLIA_CONTRACTS } from './deployments-sepolia';

export const CONTRACTS = [
    ...G7_TESTNET_CONTRACTS,
    ...ARBITRUM_ONE_CONTRACTS,
    ...BASE_SEPOLIA_CONTRACTS,
    ...ARBITRUM_SEPOLIA_CONTRACTS,
    ...POLYGON_MAINNET_CONTRACTS,
    ...POLYGON_MUMBAI_CONTRACTS,
    ...SEPOLIA_CONTRACTS,
];

export const ACHIEVO_TMP_DIR = '.achievo';
export const ABI_PATH = 'artifacts/contracts/';
