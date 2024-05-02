import {
    CONTRACT_EXTENSION_NAME,
    CONTRACT_NAME,
    CONTRACT_PROXY_CONTRACT_NAME,
    CONTRACT_PROXY_FILE_NAME,
    CONTRACT_TYPE,
    PROXY_CONTRACT_TYPE,
} from '@constants/contract';
import { NETWORK_TYPE, NetworkName } from '@constants/network';
import { TENANT } from '@constants/tenant';
import { ExtensionFunction } from '@helpers/extensions';

export interface Deployment {
    contractAbi: any;
    contractAddress: string;
    type: string;
    name: string;
    networkName: NetworkName;
    chainId: number;
    rpcUrl: string;
    currency: string;
    blockExplorerBaseUrl: string;
    privateKey: string;
    publicKey: string;
    paymasterAddresses: string[];
    fakeContractAddress: string;
    explorerUrl: string;
    salt?: string;
    upgradable?: boolean;
    proxyType?: PROXY_CONTRACT_TYPE;
    proxy?: {
        abi: any;
        address: string;
        owner: string;
    };
    proxyAdmin?: {
        abi: any;
        address: string;
        owner: string;
    };
    implementation?: {
        abi: any;
        address: string;
    };
    extensions?: {
        abi: any;
        address: string;
        functions: ExtensionFunction[];
        name: CONTRACT_EXTENSION_NAME;
    }[];
}

export interface DeploymentContract {
    contractFileName: string;
    type: CONTRACT_TYPE;
    name: string;
    chain: string;
    networkType: NETWORK_TYPE;
    tenants: TENANT[];
    verify: boolean;
    upgradable: boolean;
    dependencies: string[];
    functionCalls?: FunctionCall[];
    args?: Record<string, any>;
    version?: number;
    skipCallInitializeFn?: boolean;
}

export interface DeploymentExtensionContract
    extends Pick<DeploymentContract, 'verify' | 'args' | 'name' | 'contractFileName' | 'type'> {
    metadata: {
        // Name of the contract
        name: string;
        // URI to the metadata file
        metadataURI: string;
        // Implementation of the contract
        implementation: string;
    };
    functionsToInclude: string[];
    extensionArgs?: Record<string, any>;
}

export interface ExtensionSelector {
    functionSelector: string;
    functionSignature: string;
}

export interface DeploymentProxyContract extends Omit<DeploymentContract, 'upgradable' | 'args'> {
    proxyContractFileName: CONTRACT_PROXY_FILE_NAME;
    proxyContractName: CONTRACT_PROXY_CONTRACT_NAME;
    proxyContractType: PROXY_CONTRACT_TYPE;
    proxyInitializeFunctionName: 'initialize';
    encodeInitializeFunctionArgs: (string | number | boolean | Record<string, any>)[];
    proxyContractArgs: {
        implementation: string;
        encodeInitializeFunctionParam: 'ENCODE_INITIALIZE_FUNCTION_ACHIEVO_PROXY';
    };
    proxyContractVerify: boolean;
    extensions: DeploymentExtensionContract[];
    implementationArgs: Record<string, any>;
}

export interface FunctionCall {
    contractName: string;
    functionName: string;
    args: (string | number | boolean | Record<string, any>)[];
    contractAddress?: string;
}

export interface DeploymentMap {
    [key: string]: {
        dbPayload: object;
        explorerUrl: string;
    };
}
