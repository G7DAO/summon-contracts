import { log } from '@helpers/logger';
import { FacetCutAction, getSelectors } from '../libraries/selectors';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';

export async function deployDiamond() {
    // Get owner by private key
    const accounts = await ethers.getSigners();
    const contractOwner = accounts[0];

    log('Contract Owner: ', contractOwner.address);
    // deploy DiamondCutFacet
    const DiamondCutFacetFactory: ContractFactory = await ethers.getContractFactory('DiamondCutFacet');
    log('DiamondCutFacet deploying...');
    const diamondCutFacet: Contract = await DiamondCutFacetFactory.deploy();
    await diamondCutFacet.waitForDeployment();
    log('DiamondCutFacet deployed:', diamondCutFacet.address);
    // // deploy Diamond
    log('Diamond deploying...');

    const Diamond: ContractFactory = await ethers.getContractFactory('Diamond');
    const diamond: Contract = await Diamond.deploy(contractOwner.address, diamondCutFacet.address);
    await diamond.waitForDeployment();
    log('Diamond deployed:', diamond.address);
    log('DiamondInit deploying...');
    const DiamondInit: ContractFactory = await ethers.getContractFactory('DiamondInit');
    const diamondInit: Contract = await DiamondInit.deploy();
    await diamondInit.waitForDeployment();
    log('DiamondInit deployed:', diamondInit.address);

    // deploy facets
    log('Deploying facets');
    const FacetNames = ['DiamondLoupeFacet', 'OwnershipFacet'];
    const cut = [];
    for (const FacetName of FacetNames) {
        const Facet: ContractFactory = await ethers.getContractFactory(FacetName);
        const facet: Contract = await Facet.deploy();
        await facet.waitForDeployment();
        log(`${FacetName} deployed: ${facet.address}`);
        cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(facet),
        });
    }

    // upgrade diamond with facets
    log('Diamond Cut:', cut);
    const diamondCut: Contract = await ethers.getContractAt('IDiamondCut', diamond.address);
    // call to init function
    const functionCall = diamondInit.interface.encodeFunctionData('init');
    const tx = await diamondCut.diamondCut(cut, diamondInit.address, functionCall);
    log('Diamond cut tx: ', tx.hash);
    const receipt = await tx.wait();
    if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    log('Completed diamond cut');
    return diamond.address;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
    deployDiamond()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
