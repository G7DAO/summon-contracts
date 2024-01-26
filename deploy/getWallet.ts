import { log } from '@helpers/logger';
import { Wallet } from 'zksync-ethers';

export default function getZkWallet(privateKey: string) {
    // Initialize the wallet.
    const wallet = new Wallet(privateKey);

    log('Deployer account address: ', wallet.address);

    return wallet;
}
