import { GameSummaryArgs, RewardsArgs, RewardTokenArgs } from '@constants/constructor-args';
import { CONTRACT_FILE_NAME, CONTRACT_NAME, CONTRACT_TYPE } from '@constants/contract';
import { TENANT } from '@constants/tenant';

import { DeploymentContract } from '../../types/deployment-type';
import { NETWORK_TYPE, NetworkName } from '../network';

const chain = NetworkName.Mantle;
const networkType = NETWORK_TYPE.MAINNET;

export const MANTLE_MAINNET_CONTRACTS: DeploymentContract[] = [
    {
        contractFileName: CONTRACT_FILE_NAME.Rewards,
        type: CONTRACT_TYPE.Rewards,
        name: CONTRACT_NAME.Rewards,
        chain,
        networkType,
        tenants: [TENANT.Game7],
        verify: true,
        upgradable: false,
        dependencies: [CONTRACT_NAME.RewardToken],
        functionCalls: [],
        args: RewardsArgs.MAINNET,
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
        dependencies: [CONTRACT_NAME.Rewards],
        functionCalls: [],
        args: RewardTokenArgs.MAINNET,
    },
    {
        contractFileName: CONTRACT_FILE_NAME.GameSummary,
        type: CONTRACT_TYPE.GameSummary,
        name: CONTRACT_NAME.GameSummary,
        chain,
        networkType,
        tenants: [TENANT.HyperPlay],
        verify: true,
        upgradable: false,
        dependencies: [],
        functionCalls: [],
        args: GameSummaryArgs.MAINNET,
    },
];
