import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GameAchievements } from '../typechain-types';

describe('GameAchievements', function () {
  let gameAchievements: GameAchievements;
  let minterAccount: SignerWithAddress;
  let playerAccount: SignerWithAddress;
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
    const tx = await gameAchievements.adminMint(playerAccount.address, 1, 1, 1, 33, '', '');
    await tx.wait();
    const balance = await gameAchievements.balanceOf(playerAccount.address, 133);
    expect(Number(balance)).to.equal(1);
  });

  it('As admin must mint game summary achievement for players', async function () {
    const GAME_ID = 1;
    const randomArray = Array.from({ length: 100 }, () => Math.floor(Math.random() * 100)).filter((value, index, self) => self.indexOf(value) === index);
    const tx = await gameAchievements.adminMintGameSummary(playerAccount.address, GAME_ID, 'Omar Game', 'https://game.gg', randomArray, 2);
    await tx.wait();
    const balanceOfPlayer = await gameAchievements.balanceOf(playerAccount.address, Number(`${GAME_ID}${randomArray[0]}`));
    expect(Number(balanceOfPlayer)).to.equal(1);
  });
});
