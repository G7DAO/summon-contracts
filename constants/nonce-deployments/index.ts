import { ARBITRUM_SEPOLIA_CONTRACTS } from './deployments-arbitrum-sepolia';
import { BASE_SEPOLIA_CONTRACTS } from './deployments-base-sepolia';
import { GAME7_ARB_SEPOLIA_CONTRACTS } from './deployments-game7-arb-sepolia';
import { MANTLE_SEPOLIA_CONTRACTS } from './deployments-mantle-sepolia';
import { OP_SEPOLIA_CONTRACTS } from './deployments-op-sepolia';
import { POLYGON_MUMBAI_CONTRACTS } from './deployments-polygon-mumbai';
import { SEPOLIA_CONTRACTS } from './deployments-sepolia';
import { ZKSYNC_SEPOLIA_CONTRACTS } from './deployments-zksync-sepolia';
import { BASE_MAINNET_CONTRACTS } from './deployments-base-mainnet';
import { MANTLE_MAINNET_CONTRACTS } from './deployments-mantle-mainnet';
import { ZKSYNC_MAINNET_CONTRACTS } from './deployments-zksync-mainnet';

export const CONTRACTS = [
    ...ARBITRUM_SEPOLIA_CONTRACTS,
    ...ZKSYNC_SEPOLIA_CONTRACTS,
    ...ZKSYNC_MAINNET_CONTRACTS,
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
export const ABI_PATH_ZK = 'artifacts-zk/contracts/';
export const ABI_PATH = 'artifacts/contracts/';
