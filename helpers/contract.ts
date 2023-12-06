import axios from 'axios';
import { DeploymentMap } from 'types/deployment-type';

axios.defaults.baseURL = process.env.ACHIEVO_BASE_URL;
axios.defaults.headers.common['Authorization'] = process.env.ACHIEVO_AUTH_TOKEN;
axios.defaults.headers.post['Content-Type'] = 'application/json';

export const submitContractDeploymentsToDB = async (deployments: DeploymentMap, tenant: string) => {
    try {
        await axios.post('/v1/admin/contracts', {
            deployments,
            tenant,
        });
    } catch (error) {
        throw error;
    }
};

export const executeFunctionCallBatch = async (calls, tenant) => {
    try {
        await axios.post('/v1/admin/contracts/functions', {
            calls,
            tenant,
        });
    } catch (error) {
        throw error;
    }
};
