import '@matterlabs/hardhat-zksync-solc';
import '@matterlabs/hardhat-zksync-deploy';
import '@matterlabs/hardhat-zksync-verify';
import '@matterlabs/hardhat-zksync-upgradable';

import { ChainId, NetworkName, rpcUrls } from '@constants/network';
import { log } from '@helpers/logger';

import defaultConfig from './hardhat.config';

const { PRIVATE_KEY } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using ZkSync config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    zkSyncLocal: {
        url: 'http://localhost:3050',
        ethNetwork: 'http://localhost:8545',
        zksync: true,
        timeout: 6000000,
    },
    [NetworkName.ZkSync]: {
        url: rpcUrls[ChainId.ZkSync],
        ethNetwork: NetworkName.Ethereum,
        zksync: true,
        accounts: [PRIVATE_KEY],
        verifyURL: 'https://zksync2-mainnet-explorer.zksync.io/contract_verification',
    },
    [NetworkName.ZkSyncGoerli]: {
        url: rpcUrls[ChainId.ZkSyncGoerli],
        ethNetwork: NetworkName.Goerli,
        zksync: true,
        accounts: [PRIVATE_KEY],
        verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification',
    },
    [NetworkName.ZkSyncSepolia]: {
        url: rpcUrls[ChainId.ZkSyncSepolia],
        ethNetwork: NetworkName.Sepolia,
        zksync: true,
        accounts: [PRIVATE_KEY],
        verifyURL: 'https://explorer.sepolia.era.zksync.dev/contract_verification',
    },
};

defaultConfig.zksolc = {
    version: 'latest',
    settings: {},
};

// empty to use the verifyURL from the network config
defaultConfig.etherscan = {};
export default defaultConfig;
