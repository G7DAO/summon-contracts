import { BUIDLArgs, ERC20Args, ERC20DecimalsAgs } from '@constants/constructor-args';
import { CONTRACT_TYPE, CONTRACT_UPGRADABLE_FILE_NAME, CONTRACT_UPGRADABLE_NAME } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.BaseSepolia;
const networkType = NETWORK_TYPE.TESTNET;

export const BASE_SEPOLIA_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_UPGRADABLE_FILE_NAME.BurnableToken,
        type: CONTRACT_TYPE.ERC20,
        name: CONTRACT_UPGRADABLE_NAME.ERC20,
        chain,
        networkType,
        tenants: [TENANT.IronWorks],
        verify: false,
        upgradable: true,
        dependencies: [],
        functionCalls: [],
        args: ERC20DecimalsAgs.TESTNET,
    },
];
