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
import {
    DirectListingExtensionArgs,
    EnglishAuctionsExtensionArgs,
    MarketplaceArgs,
    OffersExtensionArgs,
} from '@constants/constructor-args';

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
        proxyContractName: CONTRACT_PROXY_CONTRACT_NAME.AchievoProxyMarketplace,
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
                    'adminCancelListing(address,uint256)',
                    'approveBuyerForListing(uint256,address,bool)',
                    'approveCurrencyForListing(uint256,address,uint256)',
                    'buyFromListing(uint256,address,uint256,address,uint256)',
                    'buyFromListingWithSignature(uint256,address,uint256,address,uint256,uint256,bytes,bytes)',
                    'getAllListings(uint256,uint256)',
                    'getAllValidListings(uint256,uint256)',
                    'getListing(uint256)',
                ],
            },
            {
                contractFileName: CONTRACT_FILE_NAME.EnglishAuctionsExtension,
                type: CONTRACT_TYPE.EnglishAuctionsExtension,
                name: CONTRACT_NAME.EnglishAuctionsExtension,
                verify: true,
                extensionArgs: EnglishAuctionsExtensionArgs.TESTNET,
                metadata: {
                    name: 'EnglishAuctionsLogic',
                    metadataURI: 'ipfs://{hash}',
                    implementation: `CONTRACT_${CONTRACT_NAME.EnglishAuctionsExtension}`,
                },
                functionsToInclude: [
                    'createAuction((address,uint256,uint256,address,uint256,uint256,uint64,uint64,uint64,uint64))',
                    'bidInAuction(uint256,uint256)',
                    'collectAuctionPayout(uint256)',
                    'collectAuctionTokens(uint256)',
                    'cancelAuction(uint256)',
                    'isNewWinningBid(uint256,uint256)',
                    'totalAuctions()',
                    'getAuction(uint256)',
                    'getAllAuctions(uint256,uint256)',
                    'getAllValidAuctions(uint256,uint256)',
                    'getWinningBid(uint256)',
                    'isAuctionExpired(uint256)',
                ],
            },
            {
                contractFileName: CONTRACT_FILE_NAME.OffersExtension,
                type: CONTRACT_TYPE.OffersExtension,
                name: CONTRACT_NAME.OffersExtension,
                verify: true,
                extensionArgs: OffersExtensionArgs.TESTNET,
                metadata: {
                    name: 'OffersLogic',
                    metadataURI: 'ipfs://{hash}',
                    implementation: `CONTRACT_${CONTRACT_NAME.OffersExtension}`,
                },
                functionsToInclude: [
                    'makeOffer((address,uint256,uint256,address,uint256,uint256))',
                    'cancelOffer(uint256)',
                    'acceptOffer(uint256)',
                    'totalOffers()',
                    'getOffer(uint256)',
                    'getAllOffers(uint256,uint256)',
                    'getAllValidOffers(uint256,uint256)',
                ],
            },
        ],
        implementationArgs: MarketplaceArgs.TESTNET,
    },
];
