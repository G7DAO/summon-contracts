import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';

import { QuestRewards, NonFunToken } from '../../typechain-types';

describe('QuestReward', function () {
    let adminAccount: SignerWithAddress;
    let gameDeveloperAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    let questReward: QuestRewards;
    let questRewardContractAddress: string;
    let nonFunToken: NonFunToken;
    let nonFunTokenContractAddress: string;

    beforeEach(async function () {
        const [admin, player, gameDev] = await ethers.getSigners();
        adminAccount = admin;
        playerAccount = player;
        gameDeveloperAccount = gameDev;
        console.log(
            'Admin account address: ',
            adminAccount.address,
            '\nPlayer account address: ',
            playerAccount.address,
            '\nGame dev account address: ',
            gameDeveloperAccount.address
        );

        const QuestRewardsFactory = await ethers.getContractFactory('QuestRewards');
        questReward = (await QuestRewardsFactory.deploy(adminAccount.address)) as QuestRewards;
        await questReward.waitForDeployment();

        const NonFunTokenFactory = await ethers.getContractFactory('NonFunToken');
        nonFunToken = (await NonFunTokenFactory.deploy()) as NonFunToken;
        await nonFunToken.waitForDeployment();

        await nonFunToken.mintCollectionNFT(gameDeveloperAccount.address, 0);
        nonFunTokenContractAddress = await nonFunToken.getAddress();
        questRewardContractAddress = await questReward.getAddress();
    });

    it('Deposits and withdraws an ERC721', async function () {
        const msg = ethers.solidityPacked(
            ['address', 'string', 'string', 'string', 'uint256', 'string', 'address', 'uint256'],
            [
                gameDeveloperAccount.address,
                'DEPOSIT',
                'ERC721',
                'TOKENID',
                0,
                'CONTRACT_ADDRESS',
                nonFunTokenContractAddress,
                0,
            ]
        );
        const msgHash = ethers.keccak256(msg);
        const signature = (await adminAccount.provider.send('eth_sign', [adminAccount.address, msgHash])) as string;

        // set approval for all for quest reward contract
        await nonFunToken.connect(gameDeveloperAccount).setApprovalForAll(questRewardContractAddress, true);

        // game developer deposits NFT
        await questReward.connect(gameDeveloperAccount).depositERC721(nonFunTokenContractAddress, 0, signature);

        const nftOwner = await nonFunToken.ownerOf(0);
        expect(nftOwner).to.equal(questRewardContractAddress);

        // get signature from admin account to withdraw
        // withdraw
    });
});
