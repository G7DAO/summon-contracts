import { ChainId, NetworkExplorer, NetworkName, rpcUrls } from './constants/network';

import defaultConfig from './hardhat.config';
import { log } from '@helpers/logger';

const { PRIVATE_KEY, ETHSCAN_API_KEY } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using Game7 L3 config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    [NetworkName.Game7Testnet]: {
        url: rpcUrls[ChainId.Game7Testnet],
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Game7Testnet,
    },
};

defaultConfig.etherscan = {
    apiKey: ETHSCAN_API_KEY,
    customChains: [
        {
            network: NetworkName.Game7Testnet,
            chainId: ChainId.Game7Testnet,
            urls: {
                apiURL: `${NetworkExplorer.Game7Testnet}/api`,
                browserURL: NetworkExplorer.Game7Testnet,
            },
        },
        {
            network: NetworkName.Game7,
            chainId: ChainId.Game7,
            urls: {
                apiURL: `${NetworkExplorer.Game7}/api`,
                browserURL: NetworkExplorer.Game7,
            },
        },
    ],
};

export default defaultConfig;
