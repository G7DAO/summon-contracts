import hre from 'hardhat';
import { CONTRACTS } from '@constants/proxy-deployments';
import { DeploymentExtensionContract, DeploymentProxyContract } from '../../../types/deployment-type';
import { Extension, ExtensionFunction } from '@helpers/extensions';
import { deployOne, deployOneWithExtensions } from '../../../tasks';
import { TENANT } from '@constants/tenant';
import {
    Marketplace,
    MockERC1155,
    MockERC20,
    MockERC721,
    MockRoyaltyEngineV1,
} from '../../../typechain-types';
import { DirectListingExtensionArgs, EnglishAuctionsExtensionArgs, MarketplaceArgs } from '@constants/constructor-args';
import { CONTRACT_EXTENSION_NAME } from '@constants/contract';

const tenant = TENANT.Game7;
const CONTRACT_NAME = 'Marketplace';

/**
 * @dev Deploys the marketplace contracts
 * @returns: [marketplace, mockERC20, mockERC721, mockERC1155, mockRoyaltyEngineV1]
 */
export async function deployMarketplaceContracts(): Promise<
    [Marketplace, MockERC20, MockERC721, MockERC1155, MockRoyaltyEngineV1]
> {
    const [mockERC20, mockERC721, mockERC1155, mockRoyaltyEngineV1] = await deployMockContracts();
    const mockERC20Address = await mockERC20.getAddress();
    const mockRoyaltyEngineV1Address = await mockRoyaltyEngineV1.getAddress();
    const deployer = (await hre.ethers.getSigners())[0];

    // Overwrite the contract arguments with the mock addresses for testing
    const contract = await getContractWithMockArgs(
        CONTRACT_NAME,
        mockERC20Address,
        deployer.address,
        mockRoyaltyEngineV1Address
    );

    const deployedExtensions = await deployExtensions(contract.extensions, tenant);
    const deployedImplementation = await deployOneWithExtensions(
        hre,
        {
            ...contract,
            verify: false,
        },
        tenant,
        deployedExtensions
    );

    // switch to the proxy contract values
    const proxyContract = {...contract}
    proxyContract.contractFileName = contract.proxyContractFileName;
    proxyContract.name = contract.proxyContractName;
    proxyContract.proxyContractArgs.implementation = deployedImplementation.contractAddress;

    const implementationContract = await hre.ethers.getContractAt(
        deployedImplementation.name,
        deployedImplementation.contractAddress
    );
    const proxyDeployment = await deployOne(hre, { ...proxyContract, verify: false }, tenant, implementationContract);
    const marketplace = await hre.ethers.getContractAt(CONTRACT_NAME, proxyDeployment.contractAddress);

    return [marketplace, mockERC20, mockERC721, mockERC1155, mockRoyaltyEngineV1];
}

async function getContractWithMockArgs(
    contractName: string,
    mockERC20Address: string,
    deployerAddress: string,
    royaltyEngineAddress: string
) {
    let contract = CONTRACTS.find((d) => d.name === contractName) as unknown as DeploymentProxyContract;
    contract.implementationArgs = {
        ...MarketplaceArgs.TESTNET,
        nativeTokenWrapper: mockERC20Address,
        royaltyEngineAddress,
    };
    contract.encodeInitializeFunctionArgs = [deployerAddress, 'contractURI', [], deployerAddress, 0];

    const englishAuctionExtension = (contract.extensions.find(
        (e) => e.name === CONTRACT_EXTENSION_NAME.DirectListingExtension
    ).extensionArgs = {
        ...DirectListingExtensionArgs.TESTNET,
        _tokenAddress: mockERC20Address,
    });
    contract.extensions.find((e) => e.name === CONTRACT_EXTENSION_NAME.EnglishAuctionsExtension).extensionArgs = {
        ...EnglishAuctionsExtensionArgs.TESTNET,
        _nativeTokenWrapper: mockERC20Address,
    };

    return contract;
}

async function deployExtensions(extensions: DeploymentExtensionContract[], tenant: string) {
    const deployedExtensions: Extension[] = [];
    for await (const extension of extensions) {
        const extensionDeployed = await deployExtension(extension, tenant);
        deployedExtensions.push(extensionDeployed);
    }

    return deployedExtensions;
}

async function deployExtension(extension: DeploymentExtensionContract, tenant: string): Promise<Extension> {
    const deployedExtensionContract = await deployOne(hre, { ...extension, verify: false }, tenant);
    const metadata = {
        name: extension.metadata.name,
        metadataURI: extension.metadata.metadataURI,
        implementation: deployedExtensionContract.contractAddress,
    };

    const contractInstance = await hre.ethers.getContractAt(
        extension.contractFileName,
        deployedExtensionContract.contractAddress
    );

    let functions: ExtensionFunction[] = [];

    for (const func of extension.functionsToInclude) {
        const selector = contractInstance.getFunction(func).getFragment().selector;
        functions.push({
            functionSelector: selector,
            functionSignature: func,
        });
    }

    return {
        metadata,
        functions,
    };
}

async function deployMockContracts(): Promise<[MockERC20, MockERC721, MockERC1155, MockRoyaltyEngineV1]> {
    const MockERC20Factory = await hre.ethers.getContractFactory('MockERC20');
    const mockERC20 = await MockERC20Factory.deploy('MockERC20', 'MockERC20');
    await mockERC20.waitForDeployment();

    const MockERC721Factory = await hre.ethers.getContractFactory('MockERC721');
    const mockERC721 = await MockERC721Factory.deploy();
    await mockERC721.waitForDeployment();

    const mockERC1155Factory = await hre.ethers.getContractFactory('MockERC1155');
    const mockERC1155 = await mockERC1155Factory.deploy();
    await mockERC1155.waitForDeployment();

    const mockRoyaltyEngineV1Factory = await hre.ethers.getContractFactory('MockRoyaltyEngineV1');
    const mockRoyaltyEngineV1 = await mockRoyaltyEngineV1Factory.deploy();
    await mockRoyaltyEngineV1.waitForDeployment();

    return [mockERC20, mockERC721, mockERC1155, mockRoyaltyEngineV1];
}
