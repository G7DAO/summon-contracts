import { HelloWorldArgs, LootDropArgs, RewardTokenArgs } from '@constants/constructor-args';
import { CONTRACT_TYPE, CONTRACT_NAME, CONTRACT_FILE_NAME } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.ZkSync;
const networkType = NETWORK_TYPE.MAINNET;

export const ZKSYNC_MAINNET_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.LootDrop,
        type: CONTRACT_TYPE.LootDrop,
        name: CONTRACT_NAME.LootDrop,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.RewardToken],
        functionCalls: [],
        args: LootDropArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.AdminERC1155Soulbound,
        type: CONTRACT_TYPE.RewardToken,
        name: CONTRACT_NAME.RewardToken,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.LootDrop],
        functionCalls: [],
        args: RewardTokenArgs.MAINNET,
    },
];