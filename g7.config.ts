import { ChainId, NetworkExplorer, NetworkName, rpcUrls } from './constants/network';

import defaultConfig from './hardhat.config';
import { log } from './helpers/logger';

const { PRIVATE_KEY, ETHSCAN_API_KEY } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using Game7 L3 config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    [NetworkName.Game7OPStackBaseSepolia]: {
        url: rpcUrls[ChainId.Game7OPStackBaseSepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Game7OPStackBaseSepolia,
    },
    [NetworkName.Game7OrbitARBOneSepolia]: {
        url: rpcUrls[ChainId.Game7OrbitARBOneSepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Game7OrbitARBOneSepolia,
    },
    [NetworkName.Game7OrbitBaseSepolia]: {
        url: rpcUrls[ChainId.Game7OrbitBaseSepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Game7OrbitBaseSepolia,
    },
};

defaultConfig.etherscan = {
    apiKey: ETHSCAN_API_KEY,
    customChains: [
        {
            network: NetworkName.Game7OPStackBaseSepolia,
            chainId: ChainId.Game7OPStackBaseSepolia,
            urls: {
                apiURL: `${NetworkExplorer.Game7OPStackBaseSepolia}/api`,
                browserURL: NetworkExplorer.Game7OPStackBaseSepolia,
            },
        },
        {
            network: NetworkName.Game7OrbitARBOneSepolia,
            chainId: ChainId.Game7OrbitARBOneSepolia,
            urls: {
                apiURL: `${NetworkExplorer.Game7OrbitARBOneSepolia}/api`,
                browserURL: NetworkExplorer.Game7OrbitARBOneSepolia,
            },
        },
        {
            network: NetworkName.Game7OrbitBaseSepolia,
            chainId: ChainId.Game7OrbitBaseSepolia,
            urls: {
                apiURL: `${NetworkExplorer.Game7OrbitBaseSepolia}/api`,
                browserURL: NetworkExplorer.Game7OrbitBaseSepolia,
            },
        },
        // TODO: Add mainnet later
    ],
};

export default defaultConfig;
