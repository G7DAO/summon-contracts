import { ChainId, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';

import defaultConfig from './hardhat.config';
import { log } from './helpers/logger';

const { PRIVATE_KEY, ETHSCAN_API_KEY } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using Mantle config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    [NetworkName.Mantle]: {
        url: rpcUrls[ChainId.Mantle],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Mantle,
    },
    [NetworkName.MantleSepolia]: {
        url: rpcUrls[ChainId.MantleSepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.MantleSepolia,
    },
};

defaultConfig.etherscan = {
    apiKey: ETHSCAN_API_KEY,
    customChains: [
        {
            network: NetworkName.Mantle,
            chainId: ChainId.Mantle,
            urls: {
                apiURL: `${NetworkExplorer.Mantle}/api`,
                browserURL: NetworkExplorer.Mantle,
            },
        },
        {
            network: NetworkName.MantleSepolia,
            chainId: ChainId.MantleSepolia,
            urls: {
                apiURL: `${NetworkExplorer.MantleSepolia}/api`,
                browserURL: NetworkExplorer.MantleSepolia,
            },
        },
    ],
};

export default defaultConfig;
