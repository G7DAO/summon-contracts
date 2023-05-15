import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
// This adds support for typescript paths mappings
import 'tsconfig-paths/register';
import { ChainId } from './constants';
dotenv.config();

const { PRIVATE_KEY, POLYGONSCAN_API_KEY, DEPLOYER_PRIVATE_KEY, REPORT_GAS } = process.env;

if (!PRIVATE_KEY) {
  throw new Error('The private key is required');
}

const config: HardhatUserConfig = {
  solidity: '0.8.17',
  defaultNetwork: 'hardhat',
  networks: {
    localhost: {
      accounts: [DEPLOYER_PRIVATE_KEY || PRIVATE_KEY],
      url: 'http://127.0.0.1:7545/',
      chainId: ChainId.Ganache,
      timeout: 6000000,
    },
    mantle: {
      url: `${process.env.MANTLE_PROVIDER_URL}`,
      accounts: [DEPLOYER_PRIVATE_KEY || PRIVATE_KEY],
      chainId: ChainId.Mantle,
    },
    polygon: {
      url: `${process.env.POLYGON_PROVIDER_URL}`,
      accounts: [DEPLOYER_PRIVATE_KEY || PRIVATE_KEY],
      chainId: ChainId.Polygon,
    },
    polygonMumbai: {
      url: 'https://rpc-mumbai.maticvigil.com',
      accounts: [PRIVATE_KEY],
      chainId: ChainId.PolygonMumbai,
    },
    mantleWadsley: {
      url: 'https://rpc.testnet.mantle.xyz/',
      accounts: [PRIVATE_KEY],
      chainId: ChainId.MantleWadsley,
    },
  },
  gasReporter: {
    enabled: REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: {
      polygonMumbai: POLYGONSCAN_API_KEY || '',
      polygon: POLYGONSCAN_API_KEY || '',
    },
  },
};

export default config;
