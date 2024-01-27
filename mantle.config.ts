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
    [NetworkName.MantleWadsley]: {
        url: rpcUrls[ChainId.MantleWadsley],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.MantleWadsley,
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
            network: NetworkName.MantleWadsley,
            chainId: ChainId.MantleWadsley,
            urls: {
                apiURL: `${NetworkExplorer.MantleWadsley}/api`,
                browserURL: NetworkExplorer.MantleWadsley,
            },
        },
    ],
};

export default defaultConfig;
