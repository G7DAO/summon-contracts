import { log } from '@helpers/logger';
import { ethers } from 'hardhat';
import { PositionMetadata, Staker } from 'typechain-types';

async function main() {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }

    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    const positionMetadataFactory = await ethers.getContractFactory('PositionMetadata', signer);
    const positionMetadataContract = (await positionMetadataFactory.deploy()) as unknown as PositionMetadata;
    await positionMetadataContract.waitForDeployment();
    const positionMetadataContractAddress = await positionMetadataContract.getAddress();

    log('PositionMetadata deployed:', positionMetadataContractAddress);

    const stakerFactory = await ethers.getContractFactory('Staker', signer);
    const stakerContract = (await stakerFactory.deploy(positionMetadataContractAddress)) as unknown as Staker;
    await stakerContract.waitForDeployment();
    const stakerContractAddress = await stakerContract.getAddress();

    log('Staker deployed:', stakerContractAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
