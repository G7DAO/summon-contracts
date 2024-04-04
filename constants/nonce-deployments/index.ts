import { ARBITRUM_SEPOLIA_CONTRACTS } from './deployments-arbitrum-sepolia';
import { BASE_SEPOLIA_CONTRACTS } from './deployments-base-sepolia';
import { MANTLE_SEPOLIA_CONTRACTS } from './deployments-mantle-sepolia';
import { OP_SEPOLIA_CONTRACTS } from './deployments-op-sepolia';
import { POLYGON_MUMBAI_CONTRACTS } from './deployments-polygon-mumbai';
import { SEPOLIA_CONTRACTS } from './deployments-sepolia';
import { ZKSYNC_SEPOLIA_CONTRACTS } from './deployments-zksync-sepolia';

export const CONTRACTS = [
    ...ARBITRUM_SEPOLIA_CONTRACTS,
    ...ZKSYNC_SEPOLIA_CONTRACTS,
    ...SEPOLIA_CONTRACTS,
    ...BASE_SEPOLIA_CONTRACTS,
    ...OP_SEPOLIA_CONTRACTS,
    ...MANTLE_SEPOLIA_CONTRACTS,
    ...POLYGON_MUMBAI_CONTRACTS,
];

export const ACHIEVO_TMP_DIR = '.achievo';
export const ABI_PATH_ZK = 'artifacts-zk/contracts/';
export const ABI_PATH = 'artifacts/contracts/';
