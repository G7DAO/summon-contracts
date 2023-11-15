import { ChainId } from './constants';
import defaultConfig from './hardhat.config';
import { log } from './helpers/logger';

const { PRIVATE_KEY, ETHSCAN_API_KEY } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using Mantle config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    mantle: {
        url: `${process.env.MANTLE_PROVIDER_URL}`,
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Mantle,
    },
    mantleWadsley: {
        url: 'https://rpc.testnet.mantle.xyz/',
        accounts: [PRIVATE_KEY],
        chainId: ChainId.MantleWadsley,
    },
};

defaultConfig.etherscan = {
    apiKey: ETHSCAN_API_KEY,
    customChains: [
        {
            network: 'mantleWadsley',
            chainId: 5001,
            urls: {
                apiURL: 'https://explorer.testnet.mantle.xyz/api',
                browserURL: 'https://explorer.testnet.mantle.xyz',
            },
        },
        {
            network: 'mantle',
            chainId: 5000,
            urls: {
                apiURL: 'https://explorer.mantle.xyz/api',
                browserURL: 'https://explorer.mantle.xyz',
            },
        },
    ],
};

export default defaultConfig;
