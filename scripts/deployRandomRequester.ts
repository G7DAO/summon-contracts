import { log } from '@helpers/logger';
import { ethers } from 'hardhat';
import { RandomRequester } from 'typechain-types';

async function main() {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }

    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const RandomRequesterContract = await ethers.getContractFactory('RandomRequester', signer);

    const RandomRequester = (await RandomRequesterContract.deploy('X')) as unknown as RandomRequester;
    await RandomRequester.waitForDeployment();
    log('RandomRequester deployed:', await RandomRequester.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
