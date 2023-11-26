import '@matterlabs/hardhat-zksync-solc';
import '@matterlabs/hardhat-zksync-deploy';
import '@matterlabs/hardhat-zksync-verify';
import '@matterlabs/hardhat-zksync-upgradable';

import defaultConfig from './hardhat.config';
import { NetworkName } from './constants';
import { log } from '@helpers/logger';

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
        url: 'https://mainnet.era.zksync.io',
        ethNetwork: 'mainnet',
        zksync: true,
        accounts: [PRIVATE_KEY],
        verifyURL: 'https://zksync2-mainnet-explorer.zksync.io/contract_verification',
    },
    [NetworkName.ZkSyncTestnet]: {
        url: 'https://zksync2-testnet.zksync.dev',
        ethNetwork: 'goerli',
        zksync: true,
        accounts: [PRIVATE_KEY],
        verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification',
    },
};

defaultConfig.zksolc = {
    version: '1.3.16',
    settings: {},
};

// empty to use the verifyURL from the network config
defaultConfig.etherscan = {};
export default defaultConfig;
