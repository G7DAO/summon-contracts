import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { Contract } from 'zksync-ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { LevelsBound, ERC1155Soulbound } from '../../typechain-types';
import { generateSignature } from '../../helpers/signature';

describe('LevelsBound', function () {
    let levelsBound: LevelsBound;
    let items: ERC1155Soulbound;
    let minterAccount: SignerWithAddress;
    let playerAccount: SignerWithAddress;
    let playerAccount2: SignerWithAddress;

    let nonce: number;
    let signature: string;

    beforeEach(async function () {
        let levelBoundcontract = (await ethers.getContractFactory('LevelsBound')) as unknown as Contract;
        let itemsBoundContract = (await ethers.getContractFactory('ERC1155Soulbound')) as unknown as Contract;
        const [adminAccount, player, player2] = await ethers.getSigners();
        minterAccount = adminAccount;
        playerAccount = player;
        playerAccount2 = player2;

        itemsBoundContract = await itemsBoundContract.deploy(
            'myItems',
            'mIs',
            'https://app.bueno.art/api/contract/J9SFsPXBW4nXJP-fake/chain/1',
            'uri',
            1,
            false,
            adminAccount.address
        );
        await itemsBoundContract.waitForDeployment();

        const itemAddress = await itemsBoundContract.getAddress();

        levelBoundcontract = await levelBoundcontract.deploy('lvl', 'lvl', adminAccount.address, true, itemAddress);
        await levelBoundcontract.waitForDeployment();

        items = itemsBoundContract as unknown as ERC1155Soulbound;
        levelsBound = levelBoundcontract as unknown as LevelsBound;

        ({ nonce, signature } = await generateSignature({
            walletAddress: playerAccount.address,
            signer: minterAccount,
        }));
    });

    it('As admin I can mint levels for a player', async function () {
        const tx = await levelsBound.adminReplaceLevel(playerAccount.address, 1);
        await tx.wait();
        const balance = await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 1);
        expect(balance).to.be.eq(1);

        expect(await levelsBound.connect(playerAccount).getMyLevel()).to.be.eq(1);

        // skip to level 10
        const tx2 = await levelsBound.adminReplaceLevel(playerAccount.address, 10);
        await tx2.wait();

        // level should be gone
        expect(await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 1)).to.be.eq(0);
        expect(await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 10)).to.be.eq(1);

        expect(await levelsBound.connect(playerAccount).getMyLevel()).to.be.eq(10);

        // roll back to level 3
        const tx3 = await levelsBound.adminReplaceLevel(playerAccount.address, 3);
        await tx3.wait();

        expect(await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 10)).to.be.eq(0);
        expect(await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 3)).to.be.eq(1);

        expect(await levelsBound.connect(playerAccount).getMyLevel()).to.be.eq(3);
    });

    it('As admin I can reset the level of a player', async function () {
        const lvlUpTrx = await levelsBound.adminReplaceLevel(playerAccount.address, 1);
        await lvlUpTrx.wait();

        expect(await levelsBound.connect(playerAccount).getMyLevel()).to.be.eq(1);

        const tx = await levelsBound.adminBurnLevel(playerAccount.address, 1);
        await tx.wait();

        // level 1 should be gone
        expect(await levelsBound.connect(playerAccount).balanceOf(playerAccount.address, 1)).to.be.eq(0);
        const playerCurrentLevel = await levelsBound.connect(playerAccount).getMyLevel();
        expect(playerCurrentLevel).to.be.eq(0);
    });

    it("The user can't have levelup twice", async function () {
        await levelsBound.setMintRandomItemEnabled(false);
        const tx = await levelsBound.connect(playerAccount).levelUp(nonce, '0x', signature);
        await tx.wait();
        await expect(levelsBound.connect(playerAccount).levelUp(nonce, '0x', signature)).to.be.revertedWith(
            'AlreadyUsedSignature'
        );
    });

    it("As user I can't transfer the level tokens", async function () {
        await expect(
            levelsBound
                .connect(playerAccount)
                .safeTransferFrom(playerAccount.address, minterAccount.address, 1, 1, ethers.toUtf8Bytes(''))
        ).to.be.revertedWith("You can't transfer this token");
    });

    it("As user I can't transfer the level tokens using the batch as well", async function () {
        await expect(
            levelsBound
                .connect(playerAccount)
                .safeBatchTransferFrom(playerAccount.address, minterAccount.address, [1], [1], ethers.toUtf8Bytes(''))
        ).to.be.revertedWith("You can't transfer this token");
    });
});
