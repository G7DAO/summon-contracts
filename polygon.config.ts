import defaultConfig from './hardhat.config';
import { ChainId, NetworkName } from './constants';
import { log } from './helpers/logger';

const { PRIVATE_KEY, POLYGONSCAN_API_KEY } = process.env;
if (!PRIVATE_KEY) {
  throw new Error('MantleConfig: The private key is required');
}

log(`Using Polygon config`);

defaultConfig.networks = {
  ...defaultConfig.networks,
  [NetworkName.Polygon]: {
    url: `${process.env.POLYGON_PROVIDER_URL}`,
    accounts: [PRIVATE_KEY],
    chainId: ChainId.Polygon,
  },
  [NetworkName.PolygonMumbai]: {
    url: 'https://rpc-mumbai.maticvigil.com',
    accounts: [PRIVATE_KEY],
    chainId: ChainId.PolygonMumbai,
  },
};

defaultConfig.etherscan = {
  apiKey: POLYGONSCAN_API_KEY,
};

export default defaultConfig;
