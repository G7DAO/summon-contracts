import { ChainId, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';

import defaultConfig from './hardhat.config';
import { log } from './helpers/logger';

const { PRIVATE_KEY, OP_API_KEY } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using OP config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    [NetworkName.OPMainnet]: {
        url: rpcUrls[ChainId.OPMainnet],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.OPMainnet,
    },
    [NetworkName.OPSepolia]: {
        url: rpcUrls[ChainId.OPSepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.OPSepolia,
    },
};

defaultConfig.etherscan = {
    apiKey: OP_API_KEY,
    customChains: [
        {
            network: NetworkName.OPMainnet,
            chainId: ChainId.OPMainnet,
            urls: {
                apiURL: 'https://api-optimistic.etherscan.io/api',
                browserURL: NetworkExplorer.OPMainnet,
            },
        },
        {
            network: NetworkName.OPSepolia,
            chainId: ChainId.OPSepolia,
            urls: {
                apiURL: 'https://api-sepolia-optimistic.etherscan.io/api',
                browserURL: NetworkExplorer.OPSepolia,
            },
        },
    ],
};

defaultConfig.sourcify = {
    enabled: false,
};

export default defaultConfig;
