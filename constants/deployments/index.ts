import { ZKSYNC_MAINNET_CONTRACTS } from './deployments-zksync-mainnet';
import { ZKSYNC_TESTNET_CONTRACTS } from './deployments-zksync-testnet';

export const CONTRACTS = [...ZKSYNC_MAINNET_CONTRACTS, ...ZKSYNC_TESTNET_CONTRACTS];

export const ACHIEVO_TMP_DIR = '.achievo';
export const ABI_PATH_ZK = 'artifacts-zk/contracts/';
export const ABI_PATH = 'artifacts/contracts/';
