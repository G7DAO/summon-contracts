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
    [NetworkName.Game7OrbitArbSepolia]: {
        url: rpcUrls[ChainId.Game7OrbitArbSepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Game7OrbitArbSepolia,
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
            network: NetworkName.Game7OrbitArbSepolia,
            chainId: ChainId.Game7OrbitArbSepolia,
            urls: {
                apiURL: `${NetworkExplorer.Game7OrbitArbSepolia}/api`,
                browserURL: NetworkExplorer.Game7OrbitArbSepolia,
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
