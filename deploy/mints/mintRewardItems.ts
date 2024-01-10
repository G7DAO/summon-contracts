import { log } from '@helpers/logger';
import { abi } from '../../artifacts-zk/contracts/ItemsRewardBound.sol/ItemsRewardBound.json';
import * as ethers from 'ethers';

export default async function () {
    const { PRIVATE_KEY } = process.env;

    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY env required');
    }

    // Create deployer object and load the artifact of the contract you want to deploy.

    log('Starting script ...');
    const ONE_UNIT = 1e18;

    const staticJsonProvider = new ethers.JsonRpcProvider('https://sepolia.era.zksync.dev', {
        chainId: 300,
        name: 'zkSyncSepolia',
    });

    const wallet = new ethers.Wallet(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        PRIVATE_KEY,
        staticJsonProvider
    );

    const itemsRewardBound = new ethers.Contract('0x0B76Ab300B8EBfFA1a5B9bd68Eb6Bf29b72a48bb', abi, wallet);

    const tx = await itemsRewardBound.addNewTokens([
        {
            tokenId: 1,
            rewardAmount: 0,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmT86CwHwRzUh9zBj6qvDB7P2Gn2wUK6BnJrn2RzESq3e3',
        },
        {
            tokenId: 2,
            rewardAmount: 250n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice2.svg',
        },
        {
            tokenId: 3,
            rewardAmount: 150n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice3.svg',
        },
        {
            tokenId: 4,
            rewardAmount: 100n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice4.svg',
        },
        {
            tokenId: 5,
            rewardAmount: 75n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice5.svg',
        },
        {
            tokenId: 6,
            rewardAmount: 50n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice6.svg',
        },
        {
            tokenId: 7,
            rewardAmount: 25n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice7.svg',
        },
        {
            tokenId: 8,
            rewardAmount: 50n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice8.svg',
        },
        {
            tokenId: 9,
            rewardAmount: 75n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice9.svg',
        },
        {
            tokenId: 10,
            rewardAmount: 100n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice10.svg',
        },
        {
            tokenId: 11,
            rewardAmount: 150n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice11.svg',
        },
        {
            tokenId: 12,
            rewardAmount: 200n,
            rewardERC20: '0x4b6021A15cB4E76DD40dE7B0d316A6a7fb613C05',
            isEther: false,
            tokenUri: 'https://achievo.mypinata.cloud/ipfs/QmUozJH2gikBkWrn3y8ei2Tqg4KjW3edQ3aq8mdFruS8oj/dice12.svg',
        },
    ]);

    await tx.wait();
    log('Items added to the contract: ', tx.hash);
}
