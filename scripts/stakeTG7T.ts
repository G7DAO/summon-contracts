import { ethers } from 'hardhat';

import { abi } from '../artifacts/contracts/governance/staker/Staker.sol/Staker.json';

async function main() {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }

    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    const staker = new ethers.Contract('0xa6B0461b7E54Fa342Be6320D4938295A81f82Cd3', abi, signer);
    // const tx = await staker.createPool(1, '0x0000000000000000000000000000000000000000', 0, false, 3600, 3600);
    // await tx.wait();
    // console.log('CREATE POOL TX: ', tx);

    const tx2 = await staker.stakeNative(37, {
        value: ethers.parseUnits('0.00000001'),
    });
    const receipt = await tx2.wait();
    console.log('STAKE TX: ', receipt);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
