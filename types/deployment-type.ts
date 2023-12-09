import { NETWORK_TYPE } from '@constants/network';

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

export interface FunctionCall {
    contractName: string;
    functionName: string;
    args: (string | number | boolean)[];
    contractAddress: string;
}
export interface DeploymentMap {
    [key: string]: {
        dbPayload: object;
        explorerUrl: string;
    };
}

export type Tenant = 'Game7' | 'zkSync';
export type ContractType = 'Avatars' | 'Items' | 'Levels';
