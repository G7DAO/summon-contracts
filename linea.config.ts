import { ChainId, NetworkExplorer, NetworkName, rpcUrls } from './constants/network';

import defaultConfig from './hardhat.config';
import { log } from '@helpers/logger';

const { PRIVATE_KEY, LINEASCAN_API_KEY } = process.env;
if (!PRIVATE_KEY || !LINEASCAN_API_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using Linea config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    [NetworkName.LineaSepolia]: {
        url: rpcUrls[ChainId.LineaSepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.LineaSepolia,
    },
    [NetworkName.Linea]: {
        url: rpcUrls[ChainId.Linea],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Linea,
    },
};

defaultConfig.etherscan = {
    apiKey: LINEASCAN_API_KEY,
    customChains: [
        {
            network: NetworkName.Linea,
            chainId: ChainId.Linea,
            urls: {
                apiURL: `${NetworkExplorer.Linea}/api`,
                browserURL: NetworkExplorer.Linea,
            },
        },
        {
            network: NetworkName.LineaSepolia,
            chainId: ChainId.LineaSepolia,
            urls: {
                apiURL: `https://api-sepolia.lineascan.build/api`,
                browserURL: 'https://sepolia.lineascan.build/address',
            },
        },
    ],
};

defaultConfig.sourcify = {
    enabled: false,
};

export default defaultConfig;
