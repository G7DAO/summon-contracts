import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-foundry';
import '@typechain/hardhat';
// This adds support for typescript paths mappings
import 'tsconfig-paths/register';
import '@openzeppelin/hardhat-upgrades';
import { log } from '@helpers/logger';
import './tasks';
import { ChainId, NetworkName, rpcUrls } from '@constants/network';

dotenv.config();
log(`Using Default Hardhat config`);

const { PRIVATE_KEY, DEPLOYER_PRIVATE_KEY, REPORT_GAS, ETHSCAN_API_KEY } = process.env;

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
        [NetworkName.Sepolia]: {
            accounts: [DEPLOYER_PRIVATE_KEY || PRIVATE_KEY],
            url: rpcUrls[ChainId.Sepolia],
            chainId: ChainId.Sepolia,
        },
        [NetworkName.Ethereum]: {
            accounts: [DEPLOYER_PRIVATE_KEY || PRIVATE_KEY],
            url: rpcUrls[ChainId.Ethereum],
            chainId: ChainId.Ethereum,
        },
    },
    gasReporter: {
        enabled: REPORT_GAS !== undefined,
        currency: 'USD',
    },
    etherscan: {
        apiKey: ETHSCAN_API_KEY,
    },
};

// @ts-ignore
config.solidity.settings.viaIR = true;

export default config;
