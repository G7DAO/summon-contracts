import { log } from '@helpers/logger';
import { ethers } from 'hardhat';

import { abi } from '../artifacts/contracts/ItemsRewardBound.sol/ItemsRewardBound.json';
import { ItemsRewardBound } from '../typechain-types';

const CONTRACT_ADDRESS = 'X_REWARD_ITEMS_CONTRACT_ADDRESS_X';

async function main() {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }

    const provider = ethers.provider;
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer) as unknown as ItemsRewardBound;

    const tx = await contract.addNewTokens([
        {
            tokenId: 2,
            rewardAmount: 250,
            rewardERC20: erc20FakeRewardAddress,
            isEther: false,
            tokenUri: string(abi.encodePacked('https://something.com', '/', _tokenId.toString())),
        },
        {},
    ]);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
