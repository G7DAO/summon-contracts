import {
    CONTRACT_FILE_NAME,
    CONTRACT_NAME,
    CONTRACT_PROXY_CONTRACT_NAME,
    CONTRACT_PROXY_FILE_NAME,
    CONTRACT_TYPE,
    PROXY_CONTRACT_TYPE,
} from '@constants/contract';
import { TENANT } from '@constants/tenant';
import { DeploymentProxyContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';
import { DirectListingExtensionArgs, MarketplaceArgs } from '@constants/constructor-args';

const chain = NetworkName.Game7OrbitArbSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const GAME7_ARB_SEPOLIA_CONTRACTS: DeploymentProxyContract[] = [
    {
        proxyContractVerify: true,
        verify: true,
        contractFileName: CONTRACT_FILE_NAME.Marketplace,
        type: CONTRACT_TYPE.Marketplace,
        name: CONTRACT_NAME.Marketplace,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        dependencies: [],
        functionCalls: [],
        proxyContractFileName: CONTRACT_PROXY_FILE_NAME.AchievoProxy,
        proxyContractName: CONTRACT_PROXY_CONTRACT_NAME.AchievoProxy,
        proxyContractType: PROXY_CONTRACT_TYPE.EIP1967,
        proxyInitializeFunctionName: 'initialize',
        encodeInitializeFunctionArgs: ['DEV_WALLET', 'contractURI', [], 'DEV_WALLET', 0],
        proxyContractArgs: {
            implementation: `CONTRACT_${CONTRACT_NAME.Marketplace}`,
            encodeInitializeFunctionParam: 'ENCODE_INITIALIZE_FUNCTION_ACHIEVO_PROXY',
        },
        extensions: [
            {
                contractFileName: CONTRACT_FILE_NAME.DirectListingsExtension,
                type: CONTRACT_TYPE.DirectListingExtension,
                name: CONTRACT_NAME.DirectListingExtension,
                verify: true,
                extensionArgs: DirectListingExtensionArgs.TESTNET,
                metadata: {
                    name: 'DirectListingsLogic',
                    metadataURI: 'ipfs://{hash}',
                    implementation: `CONTRACT_${CONTRACT_NAME.DirectListingExtension}`,
                },
                functionsToInclude: [
                    'totalListings()',
                    'isBuyerApprovedForListing(uint256,address)',
                    'isCurrencyApprovedForListing(uint256,address)',
                    'currencyPriceForListing(uint256,address)',
                    'createListing((address,uint256,uint256,address,uint256,uint128,uint128,bool))',
                    'adminCreateListing((address,uint256,uint256,address,uint256,uint128,uint128,bool),address)',
                    'updateListing(uint256,(address,uint256,uint256,address,uint256,uint128,uint128,bool))',
                    'adminUpdateListing(uint256,(address,uint256,uint256,address,uint256,uint128,uint128,bool),address)',
                    'cancelListing(uint256)',
                    'approveBuyerForListing(uint256,address,bool)',
                    'approveCurrencyForListing(uint256,address,uint256)',
                    'buyFromListing(uint256,address,uint256,address,uint256)',
                    'buyFromListingWithSignature(uint256,address,uint256,address,uint256,uint256,bytes,bytes)',
                    'getAllListings(uint256,uint256)',
                    'getAllValidListings(uint256,uint256)',
                    'getListing(uint256)',
                ],
            },
        ],
        implementationArgs: MarketplaceArgs.TESTNET,
    },
];
