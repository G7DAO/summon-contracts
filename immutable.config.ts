import { ChainId, NetworkExplorer, NetworkName, rpcUrls } from '@constants/network';

import defaultConfig from './hardhat.config';
import { log } from './helpers/logger';

const { PRIVATE_KEY, ETHSCAN_API_KEY } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using ImmutableZkEvm config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    [NetworkName.ImmutableZkEvm]: {
        url: rpcUrls[ChainId.ImmutableZkEvm],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.ImmutableZkEvm,
    },
    [NetworkName.ImmutableZkEvmTestnet]: {
        url: rpcUrls[ChainId.ImmutableZkEvmTestnet],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.ImmutableZkEvmTestnet,
    },
};

defaultConfig.etherscan = {
    apiKey: ETHSCAN_API_KEY,
    customChains: [
        {
            network: NetworkName.ImmutableZkEvm,
            chainId: ChainId.ImmutableZkEvm,
            urls: {
                apiURL: `${NetworkExplorer.ImmutableZkEvm}/api`,
                browserURL: NetworkExplorer.ImmutableZkEvm,
            },
        },
        {
            network: NetworkName.ImmutableZkEvmTestnet,
            chainId: ChainId.ImmutableZkEvmTestnet,
            urls: {
                apiURL: `${NetworkExplorer.ImmutableZkEvmTestnet}/api`,
                browserURL: NetworkExplorer.ImmutableZkEvmTestnet,
            },
        },
    ],
};
export default defaultConfig;
