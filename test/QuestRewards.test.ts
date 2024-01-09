import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { QuestRewards, NonFunToken } from '../typechain-types';

describe('QuestReward', function () {
    let adminAccount: SignerWithAddress;
    let gameDeveloperAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    let questReward: QuestRewards;
    let nonFunToken: NonFunToken;

    beforeEach(async function () {
        const [admin, player, gameDev] = await ethers.getSigners();
        adminAccount = admin;
        playerAccount = player;
        gameDeveloperAccount = gameDev;

        const QuestRewardsFactory = await ethers.getContractFactory('QuestRewards');
        questReward = await QuestRewardsFactory.deploy(adminAccount) as QuestRewards;
        await questReward.waitForDeployment();

        const NonFunTokenFactory = await ethers.getContractFactory('NonFunToken');
        nonFunToken = await NonFunTokenFactory.deploy(adminAccount) as NonFunToken;
        await nonFunToken.waitForDeployment();

        await nonFunToken.mintCollectionNFT(gameDeveloperAccount.address, 0);
    });

    it('Deposits and withdraws an ERC721', async function () {
        // game developer gets signature from admin account to deposit
        const addr = await nonFunToken.getAddress();
        
        const msg = ethers.solidityPacked(
            ["address", "string", "string", "string", "uint256", "string", "address", "uint256"],
            [
                adminAccount.address,
                "DEPOSIT",
                "ERC721",
                "TOKENID",
                0,
                "CONTRACT_ADDRESS",
                addr,
                0
            ]
        );
        const signature = await adminAccount.signMessage(msg);
        console.log('Signed the deposit! Signature: ', signature);

        // game developer deposits NFT
        await questReward.connect(gameDeveloperAccount).depositERC721(addr, 0, signature);

        const nftOwner = await nonFunToken.ownerOf(0);
        expect(nftOwner).to.equal('')

        // get signature from admin account to withdraw
        //withdraw
    })
})