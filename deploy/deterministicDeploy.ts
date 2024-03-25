import hre, { ethers } from 'hardhat';
import { utils, Provider, Contract } from 'zksync-ethers';

// EVM Chains
let bytecode;

if (hre.network.zksync) {
    // zkSync network
    bytecode =
        '0x0000000102200190000000190000c13d00000000020100190000000c02200198000000230000613d000000000101043b0000000d011001970000000e0110009c000000230000c13d0000000001000416000000000101004b000000230000c13d000000c001000039000000400010043f0000000f01000039000000800010043f0000000f02000041000000a00020043f0000002003000039000000c00030043f000000e00010043f000001000020043f0000010f0000043f0000001001000041000000260001042e0000008001000039000000400010043f0000000001000416000000000101004b000000230000c13d0000002001000039000001000010044300000120000004430000000b01000041000000260001042e000000000100001900000027000104300000002500000432000000260001042e00000027000104300000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000004000000100000000000000000000000000000000000000000000000000fffffffc000000000000000000000000ffffffff00000000000000000000000000000000000000000000000000000000ef690cc00000000000000000000000000000000000000000000000000000000048656c6c6f20576f726c642131323300000000000000000000000000000000000000000000000000000000000000000000000060000000c00000000000000000000000000000000000000000000000000000000000000000000000000000000083b12f498dfa89b7bed7175dd7fba06e128ff0b87a94cc44b27301c090746238';
} else {
    bytecode =
        '0x608080604052346100155760fc908161001b8239f35b600080fdfe60806004361015600e57600080fd5b600090813560e01c63ef690cc014602457600080fd5b3460c2578160031936011260c25760409081810181811067ffffffffffffffff82111760ae578252600f81526020906e48656c6c6f20576f726c642131323360881b8282015282519382859384528251928382860152825b848110609957505050828201840152601f01601f19168101030190f35b8181018301518882018801528795508201607c565b634e487b7160e01b84526041600452602484fd5b5080fdfea2646970667358221220fda7cb0e5b435e1cb91c68fbabd1705c12c9352bd7232c7ac6558922e150669264736f6c63430008110033';
}

const encoder = (types, values) => {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encodedParams = abiCoder.encode(types, values);
    return encodedParams.slice(2);
};

// zkSync
// const factoryAddr = '0x116f71b342f628174321CAEa3729eEF04aF6D9c7';
const factoryAddr = '0x6fbdbF62bf83FB27D522Ba0C6C104B01d8Fd151f';

const create2Address = (hre, factoryAddress, saltHex) => {
    let create2Addr;

    const unlockTime = '1657835239';
    const initCode = bytecode + encoder(['uint'], [unlockTime]);

    if (hre.network.zksync) {
        create2Addr = utils.create2Address(factoryAddress, utils.hashBytecode(bytecode), saltHex, '0x'); // zkSync
    } else {
        create2Addr = ethers.getCreate2Address(factoryAddress, saltHex, ethers.keccak256(bytecode)); // EVM chains
        // create2Addr = ethers.getCreate2Address(factoryAddress, saltHex, ethers.keccak256(initCode)); // EVM chains
    }

    return create2Addr;
};

async function deployOnEVMChain(factoryAddr, saltHex) {
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
    const saltHex = ethers.keccak256(ethers.toUtf8Bytes('hey'));

    const create2Addr = create2Address(hre, factoryAddr, saltHex);
    console.log('precomputed address:', create2Addr);

    // if (hre.network.zksync) {
    //     await deployOnZkSync(factoryAddr, saltHex);
    // } else {
    // }
    await deployOnEVMChain(factoryAddr, saltHex);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
