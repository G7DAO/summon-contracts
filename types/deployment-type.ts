import { CONTRACT_TYPE } from '@constants/contract';
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
