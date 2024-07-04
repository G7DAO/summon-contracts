import { ARBITRUM_CONTRACTS } from './deployments-arbitrum';
import { ARBITRUM_SEPOLIA_CONTRACTS } from './deployments-arbitrum-sepolia';
import { BASE_MAINNET_CONTRACTS } from './deployments-base-mainnet';
import { BASE_SEPOLIA_CONTRACTS } from './deployments-base-sepolia';
import { GAME7_ARB_SEPOLIA_CONTRACTS } from './deployments-game7-arb-sepolia';
import { MANTLE_MAINNET_CONTRACTS } from './deployments-mantle-mainnet';
import { MANTLE_SEPOLIA_CONTRACTS } from './deployments-mantle-sepolia';
import { OP_SEPOLIA_CONTRACTS } from './deployments-op-sepolia';
import { POLYGON_MUMBAI_CONTRACTS } from './deployments-polygon-mumbai';
import { SEPOLIA_CONTRACTS } from './deployments-sepolia';

export const CONTRACTS = [
    ...ARBITRUM_CONTRACTS,
    ...ARBITRUM_SEPOLIA_CONTRACTS,
    ...SEPOLIA_CONTRACTS,
    ...BASE_SEPOLIA_CONTRACTS,
    ...BASE_MAINNET_CONTRACTS,
    ...OP_SEPOLIA_CONTRACTS,
    ...MANTLE_SEPOLIA_CONTRACTS,
    ...MANTLE_MAINNET_CONTRACTS,
    ...POLYGON_MUMBAI_CONTRACTS,
    ...GAME7_ARB_SEPOLIA_CONTRACTS,
];

export const ACHIEVO_TMP_DIR = '.achievo';
export const ABI_PATH = 'artifacts/contracts/';
