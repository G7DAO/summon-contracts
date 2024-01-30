export enum CONTRACT_TYPE {
    Avatars = 'Avatars',
    Items = 'Items',
    RewardItems = 'RewardItems',
    Levels = 'Levels',
    FreeMint = 'FreeMint',
    Paymaster = 'Paymaster',
    GameSummary = 'GameSummary',
    ERC20 = 'ERC20',
    Staker = 'Staker',
    Badge = 'Badge',
    Bridge = 'Bridge',
    Token = 'Token',
}

export enum CONTRACT_FILE_NAME {
    GameSummary = 'GameSummary',
    Avatars = 'AvatarBound',
    ERC1155RoyaltiesSoulbound = 'ERC1155RoyaltiesSoulbound',
    ERC1155RewardSoulbound = 'ERC1155RewardSoulbound',
    Levels = 'LevelsBound',
    FreeMint = 'FreeMint',
    ERC20PythPaymaster = 'ERC20PythPaymaster',
    ERC20ChainlinkPaymaster = 'ERC20ChainlinkPaymaster',
    ERC1155Soulbound = 'ERC1155Soulbound',
}
export enum CONTRACT_UPGRADABLE_FILE_NAME {
    Avatars = 'AvatarBoundV1',
    ERC1155RoyaltiesSoulbound = 'ERC1155RoyaltiesSoulboundV1',
    Levels = 'LevelsBoundV1',
    ERC20ChainlinkPaymaster = 'ERC20ChainlinkPaymasterV1',
    ERC1155Soulbound = 'ERC1155SoulboundV1',
    Staker = 'StakerV1',
    Bridge = 'ERC20BridgeV1',
    BurnableToken = 'BurnableTokenV1',
}

export enum CONTRACT_UPGRADABLE_FILE_NAME_V2 {
    Avatars = 'AvatarBoundV2',
    ERC1155RoyaltiesSoulbound = 'ERC1155RoyaltiesSoulboundV2',
    Levels = 'LevelsBoundV2',
    ERC20ChainlinkPaymaster = 'ERC20ChainlinkPaymasterV2',
    ERC1155Soulbound = 'ERC1155SoulboundV2',
}

export enum CONTRACT_NAME {
    Avatars = 'Avatars',
    Items = 'Items',
    RewardItems = 'RewardItems',
    Levels = 'Levels',
    FreeMint = 'FreeMint',
    PaymasterPyth = 'PaymasterPyth',
    PaymasterChainlink = 'PaymasterChainlink',
    GameSummary = 'GameSummary',
    ERC20 = 'ERC20',
    Badge = 'Badge',
}

export enum CONTRACT_UPGRADABLE_NAME {
    Avatars = 'AvatarsUpgradable',
    Items = 'ItemsUpgradable',
    Levels = 'LevelsUpgradable',
    PaymasterChainlink = 'PaymasterChainlinkUpgradable',
    ERC20 = 'ERC20Upgradable',
    Staker = 'StakerUpgradable',
    Badge = 'BadgeUpgradable',
    BridgePolygon = 'BridgeUpgradeablePolygon',
    BridgeZkSync = 'BridgeUpgradeableZkSync',
    ZkSpork = 'ZkSpork',
}
