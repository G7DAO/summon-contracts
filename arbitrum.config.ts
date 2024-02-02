import { ChainId, NetworkName } from '@constants/network';

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
        url: 'https://arb1.arbitrum.io/rpc',
        accounts: [PRIVATE_KEY],
        chainId: ChainId.ArbitrumOne,
    },
    [NetworkName.ArbitrumSepolia]: {
        url: 'https://sepolia-rollup.arbitrum.io/rpc',
        accounts: [PRIVATE_KEY],
        chainId: ChainId.ArbitrumSepolia,
    },
};

defaultConfig.etherscan = {
    apiKey: ARBISCAN_API_KEY,
};

defaultConfig.sourcify = {
    enabled: false,
};

export default defaultConfig;
