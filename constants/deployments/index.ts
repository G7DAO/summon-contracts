import { MANTLE_WADSLEY_CONTRACTS } from './deployments-mantle-wadsley';
import { SEPOLIA_CONTRACTS } from './deployments-sepolia';
import { ZKSYNC_GOERLI_CONTRACTS } from './deployments-zksync-goerli';
import { ZKSYNC_MAINNET_CONTRACTS } from './deployments-zksync-mainnet';
import { ZKSYNC_SEPOLIA_CONTRACTS } from './deployments-zksync-sepolia';

export const CONTRACTS = [
    ...ZKSYNC_MAINNET_CONTRACTS,
    ...ZKSYNC_GOERLI_CONTRACTS,
    ...ZKSYNC_SEPOLIA_CONTRACTS,
    ...SEPOLIA_CONTRACTS,
    ...MANTLE_WADSLEY_CONTRACTS,
];

export const ACHIEVO_TMP_DIR = '.achievo';
export const ABI_PATH_ZK = 'artifacts-zk/contracts/';
export const ABI_PATH = 'artifacts/contracts/';
