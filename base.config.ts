import { ChainId, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';

import defaultConfig from './hardhat.config';
import { log } from './helpers/logger';

const { PRIVATE_KEY, ETHSCAN_API_KEY } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using Base config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    [NetworkName.Base]: {
        url: rpcUrls[ChainId.Base],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Base,
    },
    [NetworkName.BaseSepolia]: {
        url: rpcUrls[ChainId.BaseSepolia],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.BaseSepolia,
    },
};

defaultConfig.etherscan = {
    apiKey: ETHSCAN_API_KEY,
    customChains: [
        {
            network: NetworkName.Base,
            chainId: ChainId.Base,
            urls: {
                apiURL: `${NetworkExplorer.Base}/api`,
                browserURL: NetworkExplorer.Base,
            },
        },
        {
            network: NetworkName.BaseSepolia,
            chainId: ChainId.BaseSepolia,
            urls: {
                apiURL: `${NetworkExplorer.BaseSepolia}/api`,
                browserURL: NetworkExplorer.BaseSepolia,
            },
        },
    ],
};

export default defaultConfig;
