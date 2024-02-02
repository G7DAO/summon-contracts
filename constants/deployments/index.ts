import { MANTLE_WADSLEY_CONTRACTS } from './deployments-mantle-wadsley';
import { POLYGON_MAINNET_CONTRACTS } from './deployments-polygon-mainnet';
import { POLYGON_MUMBAI_CONTRACTS } from './deployments-polygon-mumbai';
import { SEPOLIA_CONTRACTS } from './deployments-sepolia';
import { ZKSYNC_MAINNET_CONTRACTS } from './deployments-zksync-mainnet';
import { ZKSYNC_SEPOLIA_CONTRACTS } from './deployments-zksync-sepolia';
import { ARBITRUM_SEPOLIA_CONTRACTS } from '@constants/deployments/deployments-arbitrum-sepolia';
import { ARBITRUM_ONE_CONTRACTS } from '@constants/deployments/deployments-arbitrum-one';

export const CONTRACTS = [
    ...ARBITRUM_ONE_CONTRACTS,
    ...ARBITRUM_SEPOLIA_CONTRACTS,
    ...POLYGON_MAINNET_CONTRACTS,
    ...POLYGON_MUMBAI_CONTRACTS,
    ...ZKSYNC_MAINNET_CONTRACTS,
    ...ZKSYNC_SEPOLIA_CONTRACTS,
    ...SEPOLIA_CONTRACTS,
    ...MANTLE_WADSLEY_CONTRACTS,
];

export const ACHIEVO_TMP_DIR = '.achievo';
export const ABI_PATH_ZK = 'artifacts-zk/contracts/';
export const ABI_PATH = 'artifacts/contracts/';
