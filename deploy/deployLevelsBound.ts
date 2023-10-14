import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { formatUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet } from 'zksync-web3';

// TODO: change here if you want to deploy/use to another contract type
import { LevelsBound } from '../typechain-types';
import { log } from '@helpers/logger';

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

const CONTRACT_NAME = 'LevelsBound';

if (!PRIVATE_KEY) throw '⛔️ Private key not detected! Add it to the .env file!';

export default async function (hre: HardhatRuntimeEnvironment) {
  log(`Running deploy script for the ${CONTRACT_NAME} featuring ZkSync`);

  // Initialize the wallet.
  const wallet = new Wallet(PRIVATE_KEY);

  const [account] = await ethers.getSigners();
  const address = account.address;
  const balance = await account.getBalance();

  log('Main account address: ', address);
  log('Main account formatted ETH: ', formatUnits(balance, 'ether'));

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet);
  const artifact = await deployer.loadArtifact(CONTRACT_NAME);

  // TODO: change here the type if you need to
  const achievoContract = (await deployer.deploy(artifact)) as LevelsBound;

  // Show the contract info.
  const contractAddress = achievoContract.address;
  log(`${artifact.contractName} was deployed to https://explorer.zksync.io/address/${contractAddress}#contract`);

  const verificationId = await hre.run('verify:verify', {
    address: contractAddress,
    contract: `contracts/${CONTRACT_NAME}.sol:${CONTRACT_NAME}`,
    constructorArguments: [],
  });
  log(`Verification ID: ${verificationId}`);
}
