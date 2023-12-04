import axios from 'axios';
import { DeploymentMap } from 'types/deployment-type';

axios.defaults.baseURL = process.env.ACHIEVO_BASE_URL;
axios.defaults.headers.common['Authorization'] = process.env.ACHIEVO_AUTH_TOKEN;
axios.defaults.headers.post['Content-Type'] = 'application/json';

export const submitContractToDB = async (deployments: DeploymentMap) => {
    try {
        await axios.post('/v1/admin/contracts', deployments);
    } catch (error) {
        throw error;
    }
};
