import fs from 'fs';
import { ChainId } from '@constants/network';
import { getABIFilePath } from '@helpers/folder';
import hre, { ethers } from 'hardhat';
import path from 'path';
import { utils } from 'zksync-ethers';

const create2Address = (isZkSync: boolean, factoryAddress: string, bytecode: string, saltHex: string) => {
    let create2Addr;
    if (isZkSync) {
        create2Addr = utils.create2Address(factoryAddress, utils.hashBytecode(bytecode), saltHex, '0x'); // zkSync
    } else {
        create2Addr = ethers.getCreate2Address(factoryAddress, saltHex, ethers.keccak256(bytecode)); // EVM chains
    }

    return create2Addr;
};

async function deployContractOnEVMChain(factoryAddr: string, saltHex: string) {
    const Factory = await ethers.getContractFactory('DeterministicDeployFactory');
    const factory = await Factory.attach(factoryAddr);

    // const lockDeploy = await factory.deploy(initCode, saltHex);
    const lockDeploy = await factory.deploy(bytecode, saltHex);
    const txReceipt = await lockDeploy.wait();

    console.log('Deployed to:', JSON.stringify(txReceipt, null, 2));

    // factory.once('Deploy', async (address) => {
    //     const helloWorldContract = HW.attach(address);
    //     console.log('hello world contract has been deployed at ', address);
    //     const greeting = await helloWorldContract.greeting();
    //     console.log(greeting);
    // });
}

async function deployOnZkSync(factoryAddr, saltHex) {
    //
}

async function main() {
    const chainsToDeploy = [
        // ChainId.ZkSyncSepolia,
        // ChainId.ArbitrumSepolia,
        // ChainId.Sepolia,
        // ChainId.PolygonMumbai,
        // ChainId.MantleWadsley,
    ];

    if (chainsToDeploy.length === 0) {
        throw new Error('No chains to deploy');
    }

    const saleString = 'thisisrandomstring';

    const saltHex = ethers.keccak256(ethers.toUtf8Bytes(saleString));

    // TODO * compile the contract and get the bytecode
    // TODO * get contract bytecode that we want to deploy
    const contractFileName = 'xyz';

    // TODO * get factoryAddress per chain
    const factoryAddr = '0x6fbdbF62bf83FB27D522Ba0C6C104B01d8Fd151f';

    await Promise.all(
        chainsToDeploy.map(async (chainId: number) => {
            const isZkSync = chainId === ChainId.ZkSyncSepolia || chainId === ChainId.ZkSync ? true : false;

            const abiPath = getABIFilePath(isZkSync, contractFileName);
            const abiContent = fs.readFileSync(path.resolve(abiPath), 'utf8');
            const { abi: contractAbi, bytecode } = JSON.parse(abiContent);

            const create2Addr = create2Address(isZkSync, factoryAddr, bytecode, saltHex);
            console.log('precomputed address:', create2Addr);

            await deployContractOnEVMChain(factoryAddr, bytecode, saltHex);
        })
    );

    // upload to db
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
