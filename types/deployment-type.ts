import { NETWORK_TYPE } from '@constants/network';
import { CONTRACT_TYPE, TENANT } from '@constants/constructor-args';

export interface Deployment {
    contractAbi: any;
    contractAddress: string;
    type: string;
    networkType: NETWORK_TYPE;
    active: boolean;
    networkName: string;
    chainId: number;
    rpcUrl: string;
    currency: string;
    blockExplorerBaseUrl: string;
    privateKey: string;
    publicKey: string;
    paymasterAddresses: string[];
    fakeContractAddress: string;
    explorerUrl: string;
    upgradable: boolean;
}

export interface DeploymentContract {
    contractName: string;
    type: CONTRACT_TYPE;
    chain: string;
    networkType: NETWORK_TYPE;
    tenants: TENANT[];
    verify: boolean;
    upgradable: boolean;
    dependencies: string[];
    functionCalls?: FunctionCall[];
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
