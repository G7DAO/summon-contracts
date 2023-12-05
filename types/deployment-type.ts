export interface DeploymentMap {
    [key: string]: {
        dbPayload: object;
        explorerUrl: string;
    };
}

export type Tenant = 'Game7' | 'zkSync';
export type ContractType = 'Avatar' | 'Items' | 'Levels';
