import {
    CONTRACT_FILE_NAME,
    CONTRACT_NAME,
    CONTRACT_PROXY_CONTRACT_NAME,
    CONTRACT_TYPE,
    PROXY_CONTRACT_TYPE,
} from '@constants/contract';
import { TENANT } from '@constants/tenant';
import { DeploymentProxyContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';
import { DirectListingExtensionArgs, MarketplaceArgs } from '@constants/constructor-args';
import { getSelectorBySignatureFunction } from '@helpers/selectors';
import { functionEncoder } from '@helpers/encoder';

const chain = NetworkName.Game7OrbitARBOneSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const GAME7_ARB_SEPOLIA_CONTRACTS: DeploymentProxyContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.Marketplace,
        type: CONTRACT_TYPE.Marketplace,
        name: CONTRACT_NAME.Marketplace,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        verify: true,
        dependencies: [CONTRACT_NAME.RewardToken],
        functionCalls: [],
        args: MarketplaceArgs.TESTNET,
        proxyContractFileName: CONTRACT_PROXY_CONTRACT_NAME.AchievoProxy,
        proxyContractType: PROXY_CONTRACT_TYPE.EIP1967,
        proxyContractArgs: {
            implementation: `CONTRACT_${CONTRACT_NAME.Marketplace}`,
            //              admin, contractUri, _trustedForwarders, _platformFeeRecipient, _platformFeeBps
            // initialize(address,      string,          address[],               address, uint256)
            encodedCallData: functionEncoder(
                ['address', 'string', 'address[]', 'address', 'uint256'],
                ['DEPLOYER_WALLET', '', [], 'DEPLOYER_WALLET', 0]
            ),
        },
        selectors: [
            getSelectorBySignatureFunction('totalListings()'),
            getSelectorBySignatureFunction('isCurrencyApprovedForListing(uint256,address)'),
            getSelectorBySignatureFunction('currencyPriceForListing(uint256,address)'),
            getSelectorBySignatureFunction(
                'createListing((address,uint256,uint256,address,uint256,uint128,uint128,bool))'
            ),
            getSelectorBySignatureFunction(
                'updateListing(uint256,(address,uint256,uint256,address,uint256,uint128,uint128,bool))'
            ),
            getSelectorBySignatureFunction('cancelListing(uint256)'),
            getSelectorBySignatureFunction('approveBuyerForListing(uint256,address,bool)'),
            getSelectorBySignatureFunction('approveCurrencyForListing(uint256,address,uint256)'),
            getSelectorBySignatureFunction('buyFromListingWithApproval(uint256,address,uint256,address,uint256)'),
            getSelectorBySignatureFunction('getAllListings(uint256,uint256)'),
            getSelectorBySignatureFunction('getAllValidListings(uint256,uint256)'),
            getSelectorBySignatureFunction('getListing(uint256)'),
        ],
        extensions: [
            {
                contractFileName: CONTRACT_FILE_NAME.DirectListingsExtension,
                type: CONTRACT_TYPE.DirectListingExtension,
                name: CONTRACT_NAME.DirectListingExtension,
                verify: true,
                args: DirectListingExtensionArgs.TESTNET,
                metadata: {
                    name: 'DirectListingsLogic',
                    metadataURI: 'ipfs://{hash}',
                    implementation: `CONTRACT_${CONTRACT_NAME.DirectListingExtension}` as `0x${string}`,
                },
            },
        ],
    },
];
