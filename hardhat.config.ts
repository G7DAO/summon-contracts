import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-toolbox';
// This adds support for typescript paths mappings
import 'tsconfig-paths/register';

import { ChainId } from './constants';
dotenv.config();

const { PRIVATE_KEY, POLYGONSCAN_API_KEY, DEPLOYER_PRIVATE_KEY, REPORT_GAS, ETHSCAN_API_KEY } = process.env;


if (!PRIVATE_KEY) {
  throw new Error('The private key is required');
}

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
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
    mantleWadsley: {
      url: 'https://rpc.testnet.mantle.xyz/',
      accounts: [DEPLOYER_PRIVATE_KEY || PRIVATE_KEY],
      chainId: ChainId.MantleWadsley,
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
  },
  gasReporter: {
    enabled: REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: ETHSCAN_API_KEY,
    customChains: [
      {
        network: "mantleWadsley",
        chainId: 5001,
        urls: {
          apiURL: "https://explorer.testnet.mantle.xyz/api",
          browserURL: "https://explorer.testnet.mantle.xyz"
        }
      },
      {
        network: "mantle",
        chainId: 5000,
        urls: {
          apiURL: "https://explorer.mantle.xyz/api",
          browserURL: "https://explorer.mantle.xyz"
        }
      }
    ]
  },
};

export default config;
