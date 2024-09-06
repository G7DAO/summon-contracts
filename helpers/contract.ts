import { CONTRACT_NAME, CONTRACT_PROXY_CONTRACT_NAME } from '@constants/contract';
import { TENANT } from '@constants/tenant';
import axios from 'axios';
import { Deployment, FunctionCall } from 'types/deployment-type';

axios.defaults.baseURL = process.env.ACHIEVO_BASE_URL;
axios.defaults.headers.common['Authorization'] = process.env.ACHIEVO_AUTH_TOKEN;
axios.defaults.headers.post['Content-Type'] = 'application/json';

export const submitContractDeploymentsToDB = async (deployments: Deployment[], tenant: TENANT) => {
    try {
        deployments.forEach((deployment) => {
            return {
                ...deployment,
                blockchainType: 'EVM',
            };
        });
        await axios.post('/v1/tenants/self/contracts', {
            deployments,
            tenant,
        });
    } catch (error) {
        console.error((error as Error).message);
        throw error;
    }
};

export const executeFunctionCallBatch = async (calls: FunctionCall[], tenant: TENANT) => {
    try {
        await axios.post('/v1/admin/contracts/functions', {
            calls,
            tenant,
        });
    } catch (error) {
        throw error;
    }
};

export const getContractFromDB = async (
    name: CONTRACT_NAME | CONTRACT_PROXY_CONTRACT_NAME,
    chainId: number
): Promise<Deployment | undefined> => {
    try {
        const { data } = await axios.get(`/v1/tenants/self/contracts/${name}${chainId ? `?chainId=${chainId}` : ''}`);
        if (data.status === 200) {
            return data.data;
        }
    } catch (error) {
        throw error;
    }
};
