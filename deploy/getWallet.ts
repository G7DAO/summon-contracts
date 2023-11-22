import { ethers } from 'hardhat';
import { log } from '@helpers/logger';
import { formatUnits } from 'ethers';
import { Wallet } from 'zksync2-js';

export default async function (privateKey: string) {
    // Initialize the wallet.
    const wallet = new Wallet(privateKey);

    log('Deployer account address: ', wallet.address);

    return wallet;
}
