import { ChainId, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';

import defaultConfig from './hardhat.config';
import { log } from './helpers/logger';

const { PRIVATE_KEY, ARBISCAN_API_KEY } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using Arbitrum config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    [NetworkName.ArbitrumOne]: {
        url: rpcUrls[ChainId.ArbitrumOne],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.ArbitrumOne,
    },
    [NetworkName.ArbitrumSepolia]: {
        url: rpcUrls[ChainId.ArbitrumSepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.ArbitrumSepolia,
    },
};

defaultConfig.etherscan = {
    apiKey: ARBISCAN_API_KEY,
    customChains: [
        {
            network: NetworkName.ArbitrumOne,
            chainId: ChainId.ArbitrumOne,
            urls: {
                apiURL: 'https://api.arbiscan.io/api',
                browserURL: NetworkExplorer.ArbitrumOne,
            },
        },
        {
            network: NetworkName.ArbitrumSepolia,
            chainId: ChainId.ArbitrumSepolia,
            urls: {
                apiURL: 'https://api-sepolia.arbiscan.io/api',
                browserURL: NetworkExplorer.ArbitrumSepolia,
            },
        },
    ],
};
export default defaultConfig;
