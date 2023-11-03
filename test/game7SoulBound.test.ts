import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Game7Badges } from '../typechain-types';
import { Game7BadgesArgs } from '../constants/constructor-args';

const { name, symbol, baseURI, maxPerMint, isPaused } = Game7BadgesArgs.TESTNET;

describe('Game7Badges', function () {
  let game7Badges: Game7Badges;
  let minterAccount: SignerWithAddress;
  let playerAccount: SignerWithAddress;
  let player2Account: SignerWithAddress;
  let player3Account: SignerWithAddress;
  beforeEach(async function () {
    const contract1 = (await ethers.getContractFactory('Game7Badges')) as unknown as Game7Badges;
    const [adminAccount, player, player2, player3] = await ethers.getSigners();
    minterAccount = adminAccount;
    playerAccount = player;
    player2Account = player2;
    player3Account = player3;

    // @ts-ignore-next-line
    game7Badges = await contract1.deploy(name, symbol, baseURI, maxPerMint, isPaused );
    await game7Badges.deployed();
    await game7Badges.unpause();
  });

  // pause and unpause 
  // fail cannot do if not manager role
  // pass if manager role
  describe("Token Exists", () => {
    it('should fail to mint if putting wrong token id and vice versa', async function () {
      expect(await game7Badges.paused()).to.be.false;
      await game7Badges.pause();
      expect(await game7Badges.paused()).to.be.true;
      
      await expect(
        game7Badges.mint(playerAccount.address, 1, 1, true)
      ).to.be.rejectedWith('TokenNotExist()');

      await game7Badges.unpause();
      await game7Badges.addNewToken(1);
      expect(await game7Badges.paused()).to.be.false;

      const tx = await game7Badges.mint(playerAccount.address, 1, 1, true);
    });
  });

  describe("Pause Mint", () => {
    it('should fail to mint if contract is paused and vice versa', async function () {
      expect(await game7Badges.paused()).to.be.false;
      await game7Badges.pause();
      expect(await game7Badges.paused()).to.be.true;
      
      await game7Badges.addNewToken(22);
      await expect(
        game7Badges.mint(playerAccount.address, 22, 1, true)
      ).to.be.revertedWith('Pausable: paused');

      await game7Badges.unpause();
      expect(await game7Badges.paused()).to.be.false;

      const tx = await game7Badges.mint(playerAccount.address, 22, 1, true);
    });
  });


  describe("Mint", () => {
    const tokenId = 1;

    it('must bound the token id properly', async function () {
      await game7Badges.addNewToken(tokenId);
      const tx = await game7Badges.mint(playerAccount.address, tokenId, 1, true);
      await tx.wait();
      await expect(
        game7Badges.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''))
      ).to.be.revertedWith('ERCSoulbound: The amount of soul bounded tokens is equal to the amount of tokens to be transferred');
      await expect(
        game7Badges.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, tokenId, 0, ethers.utils.toUtf8Bytes(''))
      ).to.be.revertedWith("ERCSoulbound: can't be zero amount");
      const tx2 = await game7Badges.mint(player2Account.address, tokenId, 1, false);
      await tx2.wait();
      const transferTrx = await game7Badges
        .connect(player2Account)
        .safeTransferFrom(player2Account.address, minterAccount.address, tokenId, 1, ethers.utils.toUtf8Bytes(''));
      await transferTrx.wait();
      expect(await game7Badges.balanceOf(playerAccount.address, tokenId)).to.be.eq(1);
      expect(await game7Badges.balanceOf(player2Account.address, tokenId)).to.be.eq(0);
    });


    it('fail if try to mint more than the limit', async function () {
      await game7Badges.addNewToken(tokenId);

      await expect(
        game7Badges.mint(playerAccount.address, tokenId, 2, true)
      ).to.be.rejectedWith('ExceedMaxMint()');
    });

    it('fail if already minted', async function () {
      await game7Badges.addNewToken(tokenId);
      await game7Badges.mint(playerAccount.address, tokenId, 1, true);

      await expect(
        game7Badges.mint(playerAccount.address, tokenId, 1, true)
      ).to.be.rejectedWith('AlreadyMinted()');
    });

    it('fail if try to mint invalid tokenId', async function () {
      const tokenId = 30;

      await expect(
        game7Badges.mint(playerAccount.address, tokenId, 1, true)
      ).to.be.rejectedWith('TokenNotExist()');
    });

    it('fail sender has no minter role', async function () {
      await expect(
        game7Badges.connect(playerAccount).mint(playerAccount.address, tokenId, 1, true)
      ).to.be.revertedWith(`AccessControl: account ${playerAccount.address.toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`);
    });
  });
 
  describe("BatchMint", () => {
    it('must bound the token id properly', async function () {
      await game7Badges.addNewToken(1);
      await game7Badges.addNewToken(2);
      await game7Badges.addNewToken(3);

      const tx2 = await game7Badges.mintBatch(playerAccount.address, [1, 2, 3], [1, 1, 1], false);
      await tx2.wait();
      const transferTrx = await game7Badges
        .connect(playerAccount)
        .safeBatchTransferFrom(playerAccount.address, minterAccount.address, [1, 2, 3], [1, 1, 1], ethers.utils.toUtf8Bytes(''));
      await transferTrx.wait();
  
      expect(await game7Badges.balanceOf(playerAccount.address, 1)).to.be.eq(0);
  
      const tx = await game7Badges.mintBatch(player2Account.address, [1, 2, 3], [1, 1, 1], true);
      await tx.wait();
  
      await expect(
        game7Badges
          .connect(player2Account)
          .safeBatchTransferFrom(player2Account.address, minterAccount.address, [1, 2, 3], [1, 1, 1], ethers.utils.toUtf8Bytes(''))
      ).to.be.revertedWith('ERCSoulbound: The amount of soul bounded tokens is equal to the amount of tokens to be transferred');
    });

    it('fail if try to mint more than the limit', async function () {
      await game7Badges.addNewToken(1);
      await game7Badges.addNewToken(2);
      await game7Badges.addNewToken(3);

      await expect(
        game7Badges.mintBatch(playerAccount.address, [1, 2, 3], [100, 200, 300], false)
      ).to.be.rejectedWith('ExceedMaxMint()');
    });

    it('fail if already minted', async function () {
      await game7Badges.addNewToken(1);
      await game7Badges.addNewToken(2);
      await game7Badges.addNewToken(3);

      await game7Badges.mintBatch(playerAccount.address, [1, 2], [1, 1], true);

      await expect(
        game7Badges.mintBatch(playerAccount.address, [1, 2, 3], [1, 1, 1], true)
      ).to.be.rejectedWith('AlreadyMinted()');
    });

    it('fail if try to mint invalid tokenId', async function () {
      await expect(
        game7Badges.mintBatch(playerAccount.address, [33, 299], [1, 1], true)
      ).to.be.rejectedWith('TokenNotExist()');
    });

    it('fail sender has no minter role', async function () {
      await expect(
        game7Badges.connect(playerAccount).mintBatch(playerAccount.address, [1, 2, 3], [100, 200, 300], false)
      ).to.be.revertedWith(`AccessControl: account ${playerAccount.address.toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`);
    });
  });
  

  it('burn - ERC1155 - must burn tokens correctly', async function () {
    await game7Badges.addNewToken(1);
    const tx = await game7Badges.mint(playerAccount.address, 1, 1, true);
    await tx.wait();
    expect(await game7Badges.balanceOf(playerAccount.address, 1)).to.be.eq(1);

    await expect(
      game7Badges.connect(playerAccount).safeTransferFrom(playerAccount.address, minterAccount.address, 1, 1, ethers.utils.toUtf8Bytes(''))
    ).to.be.revertedWith('ERCSoulbound: The amount of soul bounded tokens is equal to the amount of tokens to be transferred');


    const burnTrx = await game7Badges.connect(playerAccount).burn(playerAccount.address, 1, 1);
    await burnTrx.wait();
    expect(await game7Badges.balanceOf(playerAccount.address, 1)).to.be.eq(0);

    const tx2 = await game7Badges.mint(player2Account.address, 1, 1, false);
    await tx2.wait();

    const trx3 = await game7Badges
      .connect(player2Account)
      .safeTransferFrom(player2Account.address, player3Account.address, 1, 1, ethers.utils.toUtf8Bytes(''));
    await trx3.wait();

    expect(await game7Badges.balanceOf(player3Account.address, 1)).to.be.eq(1);

    const burnTrx2 = await game7Badges.connect(player3Account).burn(player3Account.address, 1, 1);
    await burnTrx2.wait();

    expect(await game7Badges.balanceOf(player3Account.address, 1)).to.be.eq(0);
  });


  describe("Token URI", () => {
    it('Get Uri() should fail if tokenId not exists', async function () {
      const tokenId = 1;
      await expect(
        game7Badges.uri(tokenId)
      ).to.be.rejectedWith('TokenNotExist()');
    });

    it('Get Uri() should return tokenUri if tokenId exists', async function () {
      const tokenId = 1;
      await game7Badges.addNewToken(tokenId);
      const tokenUri = await game7Badges.uri(tokenId);
      expect(tokenUri).to.be.eq(`${baseURI}${tokenId}`);
    });

    it('updateBaseUri() should fail to update new baseuri if has no manager role', async function () {
      const newBaseURI = 'https://something-new.com/';

      await expect(
        game7Badges.connect(playerAccount).updateBaseUri(newBaseURI)
      ).to.be.revertedWith(`AccessControl: account ${playerAccount.address.toLowerCase()} is missing role 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08`);
    });

    it('updateBaseUri() should pass to update new baseuri if has manager role', async function () {
      const newBaseURI = 'https://something-new.com/';
      const tokenId = 1;

      await game7Badges.addNewToken(tokenId);
      expect(await game7Badges.uri(tokenId)).to.be.eq(`${baseURI}${tokenId}`);
      
      await game7Badges.updateBaseUri(newBaseURI);
      expect(await game7Badges.uri(tokenId)).to.be.eq(`${newBaseURI}${tokenId}`);
    });
  });
});




// mint
// fail if "to address" is already minted
// fail if not minter role
// pass if minter role and "to address" is not minted


// mintBatch
// fail if "to address" is already minted
// fail if not minter role
// pass if minter role and "to address" is not minted


// safeTransferFrom
// fail if soulbound

// safeBatchTransferFrom
// fail if soulbound

// burn
// burnBatch


