import { log } from '@helpers/logger';
import { Wallet } from 'zksync2-js';

export default function (privateKey: string) {
    // Initialize the wallet.
    const wallet = new Wallet(privateKey);

    log('Deployer account address: ', wallet.address);

    return wallet;
}
