import { expect } from 'chai';
// @ts-ignore-next-line
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GameAchievements } from '../typechain-types';

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
    const tx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '');
    await tx.wait();
    const balance = await gameAchievements.balanceOf(playerAccount.address, `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`);
    expect(Number(balance)).to.equal(1);
  });

  it('As player you CANT mint twice the same achievement from the same game', async function () {
    const tx = await gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '');
    await tx.wait();
    const balance = await gameAchievements.balanceOf(playerAccount.address, `${DEFAULT_GAME_ID}${DEFAULT_ACHIEVEMENT_ID}`);
    expect(Number(balance)).to.equal(1);

    // @ts-ignore-next-line
    await expect(gameAchievements.adminMint(playerAccount.address, DEFAULT_GAME_ID, 1, DEFAULT_ACHIEVEMENT_ID, 'uri', '')).to.be.revertedWith(
      'GameAchievements: Achievement already minted'
    );
  });

  it('As admin must mint game summary achievement for players', async function () {
    const GAME_ID = 1;
    const randomArray = Array.from({ length: 50 }, () => Math.floor(Math.random() * 100)).filter((value, index, self) => self.indexOf(value) === index);
    const tx = await gameAchievements.adminMintGameSummary(playerAccount.address, GAME_ID, 'Omar Game', 'https://game.gg', randomArray, 2);
    await tx.wait();
    for (let i = 0; i < randomArray.length; i++) {
      const balance = await gameAchievements.balanceOf(playerAccount.address, `${GAME_ID}${randomArray[i]}`);
      const balanceInt = Number(balance);
      expect(balanceInt).to.equal(1);
    }
  });

  it('As an User I can get 1 GameSummary that the admin minted per game', async function () {
    const GAME_ID = 23;
    const ACHIEVEMENTS_LENGTH = 15;
    const randomArray = Array.from({ length: ACHIEVEMENTS_LENGTH }, () => Math.floor(Math.random() * 100)).filter(
      (value, index, self) => self.indexOf(value) === index
    );
    const tx = await gameAchievements.adminMintGameSummary(playerAccount.address, GAME_ID, 'Omar Game', 'https://game.gg', randomArray, 2);
    await tx.wait();
    const gameSummary = await gameAchievements.connect(playerAccount).getGameSummary(GAME_ID);
    expect(Number(gameSummary.gameId)).to.equal(GAME_ID);
    expect(Number(gameSummary.achievements)).to.equal(ACHIEVEMENTS_LENGTH);
  });

  it('As an admin I can update 1 GameSummary that is minted', async function () {
    const GAME_ID = 23;
    const ACHIEVEMENTS_LENGTH = 15;
    const randomArray = Array.from({ length: ACHIEVEMENTS_LENGTH }, () => Math.floor(Math.random() * 100)).filter(
      (value, index, self) => self.indexOf(value) === index
    );
    const tx = await gameAchievements.adminMintGameSummary(playerAccount.address, GAME_ID, 'Omar Game', 'https://game.gg', randomArray, 2);
    await tx.wait();
    const gameSummary = await gameAchievements.connect(playerAccount).getGameSummary(GAME_ID);
    expect(Number(gameSummary.gameId)).to.equal(GAME_ID);
    expect(Number(gameSummary.achievements)).to.equal(ACHIEVEMENTS_LENGTH);

    const updateTx = await gameAchievements.updateGameSummary(playerAccount.address, GAME_ID, 3);
    await updateTx.wait();
    const updatedGameSummary = await gameAchievements.connect(playerAccount).getGameSummary(GAME_ID);
    expect(Number(updatedGameSummary.gameId)).to.equal(GAME_ID);
    expect(Number(updatedGameSummary.achievements)).to.equal(3);
  });
});
