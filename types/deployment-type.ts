import { CONTRACT_PROXY_CONTRACT_NAME, CONTRACT_TYPE, PROXY_CONTRACT_TYPE } from '@constants/contract';
import { NETWORK_TYPE, NetworkName } from '@constants/network';
import { TENANT } from '@constants/tenant';

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
        // Contract address of the extension
        implementation: `0x${string}`;
    };
}

export interface ExtensionSelector {
    functionSelector: string;
    functionSignature: string;
}

export interface DeploymentProxyContract extends Omit<DeploymentContract, 'upgradable'> {
    proxyContractFileName: CONTRACT_PROXY_CONTRACT_NAME;
    proxyContractType: PROXY_CONTRACT_TYPE;
    proxyContractArgs: Record<string, any>;
    selectors: ExtensionSelector[];
    extensions: DeploymentExtensionContract[];
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
