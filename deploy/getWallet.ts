import { log } from '@helpers/logger';
import { Wallet } from 'ethers';

export default function getWallet(privateKey: string) {
    // Initialize the wallet.
    const wallet = new Wallet(privateKey);

    log('Deployer account address: ', wallet.address);

    return wallet;
}
