import defaultConfig from './hardhat.config';
import { ChainId, NetworkName } from './constants';
import { log } from './helpers/logger';

const { PRIVATE_KEY, POLYGONSCAN_API_KEY, POLYGON_ALCHEMY_PROVIDER, POLYGON_PROVIDER_URL } = process.env;
if (!PRIVATE_KEY) {
    throw new Error('MantleConfig: The private key is required');
}

log(`Using Polygon config`);

defaultConfig.networks = {
    ...defaultConfig.networks,
    [NetworkName.Polygon]: {
        url: POLYGON_ALCHEMY_PROVIDER || POLYGON_PROVIDER_URL || 'https://polygon.llamarpc.com',
        accounts: [PRIVATE_KEY],
        chainId: ChainId.Polygon,
    },
    [NetworkName.PolygonMumbai]: {
        url: POLYGON_ALCHEMY_PROVIDER || POLYGON_PROVIDER_URL || 'https://rpc.ankr.com/polygon_mumbai',
        accounts: [PRIVATE_KEY],
        chainId: ChainId.PolygonMumbai,
    },
};

defaultConfig.etherscan = {
    apiKey: POLYGONSCAN_API_KEY,
};

defaultConfig.sourcify = {
    enabled: false,
};

export default defaultConfig;
