import { ChainId } from '../constants';
import debug from 'debug';

const logger: debug.Debugger = debug('Achievo:log');
logger.enabled = true;

export const log = logger;

export const logExplorerAddress = (chainId: number, address: string) => {
    switch (chainId) {
        case ChainId.Ganache: {
            log('Local Contract address: ', address);
            break;
        }
        case ChainId.PolygonMumbai: {
            log(`https://mumbai.polygonscan.com/address/${address}`);
            break;
        }
        case ChainId.Polygon: {
            log(`https://polygonscan.com/address/${address}`);
            break;
        }
        case ChainId.Mantle: {
            log('https://explorer.testnet.mantle.xyz/address/' + address);
            break;
        }
        case ChainId.MantleWadsley: {
            log('https://explorer.testnet.mantle.xyz/address/' + address);
            break;
        }
        case ChainId.ZkSync: {
            log('https://explorer.zksync.io/address/' + address);
            break;
        }
        case ChainId.ZkSyncGoerli: {
            log('https://goerli.explorer.zksync.io/address/' + address);
            break;
        }
        case ChainId.ZkSyncSepolia: {
            log('https://sepolia.explorer.zksync.io/address/' + address);
            break;
        }
        default: {
            return new Error('Chain Id provided do not supported.');
        }
    }
};
