// import { log } from '@helpers/logger';
// import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
// import { formatUnits } from 'ethers/lib/utils';
// import { ethers } from 'hardhat';
// import * as hre from 'hardhat';
// import { Wallet } from 'zksync-web3';
//
// // load wallet private key from env file
// const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
//
// if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';
//
// export default async function () {
//   log(`Running deploy script for the Summon Avatar Soulbound contract + Upgradeable functionality`);
//
//   // Initialize the wallet.
//
//   const [account] = await ethers.getSigners();
//   const address = account.address;
//   const balance = await account.getBalance();
//
//   log('Main account address: ', address);
//   log('Main account formatted ETH: ', formatUnits(balance, 'ether'));
//
//   // Create deployer object and load the artifact of the contract you want to deploy.
//   const wallet = new Wallet(PRIVATE_KEY);
//   const deployer = new Deployer(hre, wallet);
//   const artifact = await deployer.loadArtifact('AvatarUpgradeableV1');
//   // Estimate contract deployment fee
//   const summonContract = await hre.zkUpgrades.deployProxy(deployer.zkWallet, artifact, []);
//   log('AvatarUpgradeable deployed to:', summonContract.address);
//
//   // verify contract on zkSync
//   // const verificationId = await hre.run('verify:verify', {
//   //   address: summonContract.address,
//   //   contract: 'contracts/AvatarUpgradeable.sol:AvatarUpgradeable',
//   //   constructorArguments: [],
//   // });
//
//   // console.log(`Verification ID: ${verificationId}`);
// }
