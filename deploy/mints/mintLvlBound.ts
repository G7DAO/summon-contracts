import { ethers } from 'hardhat';

import { abi } from '../../artifacts-zk/contracts/upgradables/LevelsBoundV1.sol/LevelsBoundV1.json';
import { LevelsBoundV1 } from '../../typechain-types';
// import addressesToMint from './addresses.json';
// read from a json file the addresses

const memoryAddresses = [{ walletAddress: '0x7136fbddd4dffa2369a9283b6e90a040318011ca', rank: 1.5 }];

async function main() {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }
    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const lvlBound = new ethers.Contract('FILL_ME', abi, signer) as LevelsBoundV1;

    for await (const user of memoryAddresses) {
        const tx = await lvlBound.levelUp(user.walletAddress, Math.floor(user.rank));
        await tx.wait();
        console.log('TX: ', tx.hash);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
