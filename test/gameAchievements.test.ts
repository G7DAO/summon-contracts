import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GameAchievements } from '../typechain-types';
import { generateSignature } from '../helpers/signature';

describe('GameAchievements', function () {
  let gameAchievements: GameAchievements;
  let minterAccount: SignerWithAddress;
  let playerAccount: SignerWithAddress;
  const DEFAULT_GAME_ID = 1;
  const DEFAULT_ACHIEVEMENT_ID = 2354;
  const defaultBaseURI = 'https://summon.mypinata.cloud/ipfs/';
  beforeEach(async function () {
    const contract = (await ethers.getContractFactory('GameAchievements')) as unknown as GameAchievements;
    const [adminAccount, player] = await ethers.getSigners();
    minterAccount = adminAccount;
    playerAccount = player;
    // @ts-ignore-next-line
    gameAchievements = await contract.deploy(defaultBaseURI);
    await gameAchievements.deployed();
    await gameAchievements.grantRole('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', minterAccount.address);
  });

  it('As admin must mint specific achievements of a player', async function () {
    const tx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true);
    await tx.wait();
    const balance = await gameAchievements.balanceOf(playerAccount.address, `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`);
    expect(Number(balance)).to.equal(1);
  });

  it('As player using a signature provided by an admin must mint specific achievements', async function () {
    const { signature, nonce } = await generateSignature({ walletAddress: playerAccount.address, signer: minterAccount });
    const whitelistTx = await gameAchievements.setSigner(minterAccount.address);
    await whitelistTx.wait();
    const tx = await gameAchievements
      .connect(playerAccount)
      .mintAchievementWithSignature(DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'some_achievement_uri', 'desc', nonce, signature);
    await tx.wait();
    const balance = await gameAchievements.balanceOf(playerAccount.address, `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`);
    expect(Number(balance)).to.equal(1);
  });

  it('As player you CANT mint twice the same achievement from the same game', async function () {
    const tx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true);
    await tx.wait();
    const balance = await gameAchievements.balanceOf(playerAccount.address, `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`);
    expect(Number(balance)).to.equal(1);

    // @ts-ignore-next-line
    await expect(gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true)).to.be.revertedWith(
      'GameAchievements: Achievement already minted'
    );
  });

  it('As Player must mint game summary achievement for myself', async function () {
    const { signature, nonce } = await generateSignature({ walletAddress: playerAccount.address, signer: minterAccount });
    const whitelistTx = await gameAchievements.setSigner(minterAccount.address);
    await whitelistTx.wait();
    const GAME_ID = 1;
    const randomAchievementIds = [1234, 65441, 12312];
    const tx = await gameAchievements
      .connect(playerAccount)
      .mintGameSummaryWithSignature(GAME_ID, 'Omar Game', 'https://game.gg', randomAchievementIds, 2, nonce, signature);
    await tx.wait();
    for (let i = 0; i < randomAchievementIds.length; i++) {
      const balance = await gameAchievements.balanceOf(playerAccount.address, `${GAME_ID}${randomAchievementIds[i]}`);
      const balanceInt = Number(balance);
      expect(balanceInt).to.equal(1);
    }
  });

  it('As player must mint game summary achievement using the signature', async function () {
    const GAME_ID = 1;
    const randomAchievementIds = [1234, 65441, 12312];
    const tx = await gameAchievements.adminMintGameSummary(playerAccount.address, GAME_ID, 'Omar Game', 'https://game.gg', randomAchievementIds, 2, true);
    await tx.wait();
    for (let i = 0; i < randomAchievementIds.length; i++) {
      const balance = await gameAchievements.balanceOf(playerAccount.address, `${GAME_ID}${randomAchievementIds[i]}`);
      const balanceInt = Number(balance);
      expect(balanceInt).to.equal(1);
    }
  });

  it('The pause functionality should works as expected', async function () {
    const tx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true);
    await tx.wait();

    await gameAchievements.pauseAchievementMint();

    // @ts-ignore-next-line
    await expect(gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true)).to.be.revertedWith(
      'GameAchievements: Sorry, this function is paused'
    );

    await gameAchievements.unpauseAchievementMint();

    const tx2 = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, 99, 'uri', '', true);
    await tx2.wait();
    const balance = await gameAchievements.balanceOf(playerAccount.address, `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`);
    expect(Number(balance)).to.equal(1);
  });

  it('As admin must mint a batch of game summaries achievement for players', async function () {
    const GAME_IDS = [1, 2, 3];
    const randomArrayAchievementsIds1 = [12345, 654421, 123132, 12312];
    const randomArrayAchievementsIds2 = [1231234, 6545641, 9999];
    const randomArrayAchievementsIds3 = [6661234, 33365441, 22212312];

    const tx = await gameAchievements.adminBatchMintGameSummary(
      [playerAccount.address, minterAccount.address, playerAccount.address],
      GAME_IDS,
      ['Omar Game', 'Omar Game 2', 'Omar Game 3'],
      ['https://game.gg', 'https://game2.gg', 'https://game3.gg'],
      [randomArrayAchievementsIds1, randomArrayAchievementsIds2, randomArrayAchievementsIds3],
      [2, 2, 2],
      [true, true, true]
    );
    await tx.wait();
    for (let i = 0; i < randomArrayAchievementsIds1.length; i++) {
      const balance = await gameAchievements.balanceOf(playerAccount.address, `${GAME_IDS[0]}${randomArrayAchievementsIds1[i]}`);
      const balanceInt = Number(balance);
      expect(balanceInt).to.equal(1);
    }

    for (let i = 0; i < randomArrayAchievementsIds2.length; i++) {
      const balance = await gameAchievements.balanceOf(minterAccount.address, `${GAME_IDS[1]}${randomArrayAchievementsIds2[i]}`);
      const balanceInt = Number(balance);
      expect(balanceInt).to.equal(1);
    }

    for (let i = 0; i < randomArrayAchievementsIds3.length; i++) {
      const balance = await gameAchievements.balanceOf(playerAccount.address, `${GAME_IDS[2]}${randomArrayAchievementsIds3[i]}`);
      const balanceInt = Number(balance);
      expect(balanceInt).to.equal(1);
    }
  });

  it('As an User I can get 1 GameSummary that the admin minted per game', async function () {
    const GAME_ID = 23;
    const randomArray = [1234, 65441, 12312];
    const tx = await gameAchievements.adminMintGameSummary(playerAccount.address, GAME_ID, 'Omar Game', 'https://game.gg', randomArray, 2, true);
    await tx.wait();
    const gameSummary = await gameAchievements.connect(playerAccount).getGameSummary(GAME_ID);
    expect(Number(gameSummary.gameId)).to.equal(GAME_ID);
    expect(Number(gameSummary.achievements)).to.equal(randomArray.length);
  });

  it('As an User I can get multiple GameSummaries that the admin minted per game', async function () {
    const GAME_IDS = [1, 2, 3];
    const randomArrayAchievementsIds1 = [12345, 654421, 123132, 12312];
    const randomArrayAchievementsIds2 = [1231234, 6545641, 9999];
    const randomArrayAchievementsIds3 = [6661234, 33365441, 22212312];

    const tx = await gameAchievements.adminBatchMintGameSummary(
      [playerAccount.address, playerAccount.address, playerAccount.address],
      GAME_IDS,
      ['Omar Game', 'Omar Game 2', 'Omar Game 3'],
      ['https://game.gg', 'https://game2.gg', 'https://game3.gg'],
      [randomArrayAchievementsIds1, randomArrayAchievementsIds2, randomArrayAchievementsIds3],
      [2, 2, 2],
      [true, true, true]
    );
    await tx.wait();
    const gameSummaries = await gameAchievements.connect(playerAccount).getGameSummaries(GAME_IDS);
    expect(Number(gameSummaries[0].gameId)).to.equal(GAME_IDS[0]);
    expect(Number(gameSummaries[0].achievements)).to.equal(randomArrayAchievementsIds1.length);

    expect(Number(gameSummaries[1].gameId)).to.equal(GAME_IDS[1]);
    expect(Number(gameSummaries[1].achievements)).to.equal(randomArrayAchievementsIds2.length);

    expect(Number(gameSummaries[2].gameId)).to.equal(GAME_IDS[2]);
    expect(Number(gameSummaries[2].achievements)).to.equal(randomArrayAchievementsIds3.length);
  });

  it('As an Admin the BaseURI functionality should works', async function () {
    const tx = await gameAchievements.setBaseUri('ipfs://some1234hash/folder/');
    await tx.wait();
    const baseURI = await gameAchievements.baseUri();
    expect(baseURI).to.equal('ipfs://some1234hash/folder/');

    const mintTx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true);
    await mintTx.wait();
    const uri = await gameAchievements.uri(`${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`);
    expect(uri).to.equal(`ipfs://some1234hash/folder/${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}.json`);
  });

  it('As an admin I can update 1 GameSummary that is minted', async function () {
    const GAME_ID = 23;
    const randomArray = [12345, 654421, 123132, 12312];
    const tx = await gameAchievements.adminMintGameSummary(playerAccount.address, GAME_ID, 'Omar Game', 'https://game.gg', randomArray, 2, true);
    await tx.wait();
    const gameSummary = await gameAchievements.connect(playerAccount).getGameSummary(GAME_ID);
    expect(Number(gameSummary.gameId)).to.equal(GAME_ID);
    expect(Number(gameSummary.achievements)).to.equal(randomArray.length);

    const newAchievements = [5555, 22222, 33333];
    const updateTx = await gameAchievements.updateGameSummary(playerAccount.address, GAME_ID, newAchievements, true);
    await updateTx.wait();
    const updatedGameSummary = await gameAchievements.connect(playerAccount).getGameSummary(GAME_ID);
    expect(Number(updatedGameSummary.gameId)).to.equal(GAME_ID);
    expect(Number(updatedGameSummary.achievements)).to.equal(randomArray.length + newAchievements.length);
  });

  it('As user I cant transfer/sell any achievement if is a SBT', async function () {
    const tx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true);
    await tx.wait();
    await expect(
      gameAchievements
        .connect(playerAccount)
        .safeTransferFrom(playerAccount.address, minterAccount.address, `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`, 1, ethers.utils.toUtf8Bytes(''))
    ).to.be.revertedWith("GameAchievements: You can't transfer this token");

    // simulating a listing on any marketplace
    await gameAchievements.setApprovalForAll('0xa5409ec958c83c3f309868babaca7c86dcb077c1', true);
    await expect(
      gameAchievements
        .connect(playerAccount)
        .safeTransferFrom(
          playerAccount.address,
          '0xa5409ec958c83c3f309868babaca7c86dcb077c1',
          `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`,
          1,
          ethers.utils.toUtf8Bytes('')
        )
    ).to.be.revertedWith("GameAchievements: You can't transfer this token");
  });

  it('As user I can transfer/sell any achievement if is not a SBT', async function () {
    const tx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', false);
    await tx.wait();
    const transferTx = await gameAchievements
      .connect(playerAccount)
      .safeTransferFrom(playerAccount.address, minterAccount.address, `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`, 1, ethers.utils.toUtf8Bytes(''));
    await transferTx.wait();
    const balance = await gameAchievements.balanceOf(minterAccount.address, `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`);
    expect(Number(balance)).to.equal(1);
  });

  it('As user I cant transfer any SBT using the safeBatchTransferFrom', async function () {
    const TOKEN_ID_1 = `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`;
    const TOKEN_ID_2 = `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID + 1}`;
    const TOKEN_ID_3 = `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID + 2}`;
    const TOKEN_ID_4 = `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID + 3}`;
    const sbt1Trx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true);
    const sbt2Trx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID + 1, 'uri', '', true);
    const sbt3Trx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID + 2, 'uri', '', false);
    const sbt4Trx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID + 3, 'uri', '', false);
    await sbt1Trx.wait();
    await sbt2Trx.wait();
    await sbt3Trx.wait();
    await sbt4Trx.wait();

    // must revert because  at least 1 token is a SBT
    await expect(
      gameAchievements
        .connect(playerAccount)
        .safeBatchTransferFrom(playerAccount.address, minterAccount.address, [TOKEN_ID_1, TOKEN_ID_2, TOKEN_ID_3], [1, 1], ethers.utils.toUtf8Bytes(''))
    ).to.be.revertedWith("GameAchievements: You can't transfer this token");

    const balance = await gameAchievements.balanceOf(minterAccount.address, `${TOKEN_ID_1}`);
    const balance2 = await gameAchievements.balanceOf(minterAccount.address, `${TOKEN_ID_2}`);
    expect(Number(balance)).to.equal(0);
    expect(Number(balance2)).to.equal(0);

    // But if the token is not a SBT, it should works
    const transferTx = await gameAchievements
      .connect(playerAccount)
      .safeBatchTransferFrom(playerAccount.address, minterAccount.address, [TOKEN_ID_3, TOKEN_ID_4], [1, 1], ethers.utils.toUtf8Bytes(''));
    await transferTx.wait();
    const balance3 = await gameAchievements.balanceOf(minterAccount.address, `${TOKEN_ID_3}`);
    const balance4 = await gameAchievements.balanceOf(minterAccount.address, `${TOKEN_ID_4}`);
    expect(Number(balance3)).to.equal(1);
    expect(Number(balance4)).to.equal(1);
  });

  it('As an admin I should be able to update the soulBound item of an user', async function () {
    const TOKEN_ID_1 = `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`;
    const sbt1Trx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true);
    await sbt1Trx.wait();

    const tx = await gameAchievements.updateAchievementSoulBound(playerAccount.address, TOKEN_ID_1, false);
    await tx.wait();

    const transferTx = await gameAchievements
      .connect(playerAccount)
      .safeTransferFrom(playerAccount.address, minterAccount.address, TOKEN_ID_1, 1, ethers.utils.toUtf8Bytes(''));

    await transferTx.wait();
    const balance = await gameAchievements.balanceOf(minterAccount.address, `${TOKEN_ID_1}`);
    expect(Number(balance)).to.equal(1);
  });

  it('As an admin I should be able to remove the signer', async function () {
    const { signature, nonce } = await generateSignature({ walletAddress: playerAccount.address, signer: minterAccount });
    const addTx = await gameAchievements.setSigner(minterAccount.address);
    await addTx.wait();
    expect(await gameAchievements.connect(playerAccount).verifySignature(nonce, signature)).to.be.equal(true);
    const removeTx = await gameAchievements.removeSigner(minterAccount.address);
    await removeTx.wait();
    expect(await gameAchievements.connect(playerAccount).verifySignature(nonce, signature)).to.be.equal(false);
  });

  it('As a user I could burn any not SBT', async function () {
    const TOKEN_ID_1 = `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`;
    const sbt1Trx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', false);
    await sbt1Trx.wait();

    const burnTx = await gameAchievements.connect(playerAccount).burn(playerAccount.address, TOKEN_ID_1, 1);
    await burnTx.wait();

    const balance = await gameAchievements.balanceOf(playerAccount.address, TOKEN_ID_1);
    expect(Number(balance)).to.equal(0);
  });

  it('As a user I cant burn any SBT', async function () {
    const TOKEN_ID_1 = `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`;
    const sbt1Trx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '', true);
    await sbt1Trx.wait();
    await expect(gameAchievements.connect(playerAccount).burn(playerAccount.address, TOKEN_ID_1, 1)).to.be.revertedWith(
      "GameAchievements: You can't burn this token"
    );
  });
});
