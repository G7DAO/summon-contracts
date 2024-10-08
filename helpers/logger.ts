import { ChainId } from '@constants/network';
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
            log('https://explorer.mantle.xyz/address/' + address);
            break;
        }
        case ChainId.MantleSepolia: {
            log('https://explorer.sepolia.mantle.xyz/address/' + address);
            break;
        }
        default: {
            return new Error('Chain Id provided do not supported.');
        }
    }
};
