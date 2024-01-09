import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { QuestRewards } from '../typechain-types';

describe('QuestReward', function () {
    let minterAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    let questReward: QuestRewards;

    beforeEach(async function () {
        const [adminAccount, player] = await ethers.getSigners();
        minterAccount = adminAccount;
        playerAccount = player;

        const QuestRewardsFactory = await ethers.getContractFactory('QuestRewards');
        questReward = await QuestRewardsFactory.deploy() as QuestRewards;
        await questReward.waitForDeployment();
    });

    it('Deposits and withdraws an ERC721', async function () {
        console.log('hello');
    })
})