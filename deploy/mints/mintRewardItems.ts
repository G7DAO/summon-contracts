import { log } from '@helpers/logger';
import { abi } from '../../artifacts-zk/contracts/ItemsRewardBound.sol/ItemsRewardBound.json';
import getWallet from '../getWallet';
import { Contract } from 'zksync-ethers';

async function main() {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }

    const wallet = getWallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.

    log('Starting script ...');
    const ONE_UNIT = 1e18;

    const itemsRewardBound = new Contract('0x7A82a6944c41AC8b8f15DE40A08967c5cF979881', abi);

    const tx = await itemsRewardBound.addNewTokens([
        {
            tokenId: 1,
            rewardAmount: 0,
            rewardERC20: '',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmT86CwHwRzUh9zBj6qvDB7P2Gn2wUK6BnJrn2RzESq3e3',
        },
        {
            tokenId: 2,
            rewardAmount: 250 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice2.svg',
        },
        {
            tokenId: 3,
            rewardAmount: 150 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice3.svg',
        },
        {
            tokenId: 4,
            rewardAmount: 100 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice4.svg',
        },
        {
            tokenId: 5,
            rewardAmount: 75 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice5.svg',
        },
        {
            tokenId: 6,
            rewardAmount: 50 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice6.svg',
        },
        {
            tokenId: 7,
            rewardAmount: 25 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice7.svg',
        },
        {
            tokenId: 8,
            rewardAmount: 50 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice8.svg',
        },
        {
            tokenId: 9,
            rewardAmount: 75 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice9.svg',
        },
        {
            tokenId: 10,
            rewardAmount: 100 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice10.svg',
        },
        {
            tokenId: 11,
            rewardAmount: 150 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice11.svg',
        },
        {
            tokenId: 12,
            rewardAmount: 200 * ONE_UNIT,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice12.svg',
        },
    ]);

    await tx.wait();
    log('Items added to the contract: ', tx.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
