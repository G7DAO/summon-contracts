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
    [NetworkName.Game7Sepolia]: {
        url: rpcUrls[ChainId.Game7Sepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Game7Sepolia,
    },
};

defaultConfig.etherscan = {
    apiKey: ETHSCAN_API_KEY,
    customChains: [
        {
            network: NetworkName.Game7Sepolia,
            chainId: ChainId.Game7Sepolia,
            urls: {
                apiURL: `${NetworkExplorer.Game7Sepolia}/api`,
                browserURL: NetworkExplorer.Game7Sepolia,
            },
        },
        // TODO: Add mainnet later
    ],
};

export default defaultConfig;
