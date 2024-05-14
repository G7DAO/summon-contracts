export enum CONTRACT_TYPE {
    LegacyAvatar = 'LegacyAvatar',
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
    Whitelist = 'Whitelist',
    SkillTree = 'SkillTree',
    DETERMINISTIC_FACTORY_CONTRACT = 'DeterministicDeployFactory',
    LootDrop = 'LootDrop',
    HelloWorld = 'HelloWorld',
    RewardToken = 'RewardToken',
    DirectListingExtension = 'DirectListingExtension',
    Marketplace = 'Marketplace',
    EnglishAuctionsExtension = 'EnglishAuctionsExtension',
    OffersExtension = 'OffersExtension'
}

export enum PROXY_CONTRACT_TYPE {
    EIP2535 = 'EIP2535',
    TransparentUpgradeableProxy = 'TransparentUpgradeableProxy',
    EIP1967 = 'EIP1967',
}

export enum CONTRACT_PROXY_CONTRACT_NAME {
    AchievoProxy = 'AchievoProxy',
    Diamond = 'Diamond',
    MarketplaceAchievoProxy = 'MarketplaceAchievoProxy',
}

export enum CONTRACT_PROXY_FILE_NAME {
    AchievoProxy = 'AchievoProxy',
    Diamond = 'Diamond',
}

export enum CONTRACT_FILE_NAME {
    GameSummary = 'GameSummary',
    Avatars = 'AvatarBound',
    ERC1155RoyaltiesSoulbound = 'ERC1155RoyaltiesSoulbound',
    ERC1155RewardSoulbound = 'ERC1155RewardSoulbound',
    Levels = 'LevelsBound',
    FreeMint = 'FreeMint',
    ERC20ChainlinkPaymaster = 'ERC20ChainlinkPaymaster',
    ERC1155Soulbound = 'ERC1155Soulbound',
    Bridge = 'ERC20Bridge',
    Whitelist = 'Whitelist',
    DETERMINISTIC_FACTORY_CONTRACT = 'DeterministicDeployFactory',
    LootDrop = 'LootDrop',
    HelloWorld = 'HelloWorld',
    AdminERC1155Soulbound = 'AdminERC1155Soulbound',
    DirectListingsExtension = 'DirectListingsLogic',
    ERC20 = 'MockERC20',
    Marketplace = 'Marketplace',
    EnglishAuctionsExtension = 'EnglishAuctionsLogic',
    OffersExtension = 'OffersLogic'
}

export enum CONTRACT_UPGRADABLE_FILE_NAME {
    LegacyAvatar = 'LegacyAvatarUpgradeableV1',
    Avatars = 'AvatarBoundV1',
    ERC1155RoyaltiesSoulbound = 'ERC1155RoyaltiesSoulboundV2',
    Levels = 'LevelsBoundV1',
    ERC20ChainlinkPaymaster = 'ERC20ChainlinkPaymasterV2',
    ERC1155Soulbound = 'ERC1155SoulboundV1',
    Staker = 'ERC20StakeV1',
    Bridge = 'ERC20BridgeV1',
    BurnableToken = 'BurnableTokenV1',
    ERC1155RewardSoulbound = 'ERC1155RewardSoulboundV1',
    Marketplace = 'Marketplace',
}

export enum CONTRACT_UPGRADABLE_FILE_NAME_V2 {
    Avatars = 'AvatarBoundV2',
    ERC1155RoyaltiesSoulbound = 'ERC1155RoyaltiesSoulboundV2',
    Levels = 'LevelsBoundV2',
    ERC20ChainlinkPaymaster = 'ERC20ChainlinkPaymasterV3',
    ERC1155Soulbound = 'ERC1155SoulboundV2',
}

export enum CONTRACT_NAME {
    Avatars = 'Avatars',
    Items = 'Items',
    RewardItems = 'RewardItems',
    Levels = 'Levels',
    FreeMint = 'FreeMint',
    PaymasterChainlink = 'PaymasterChainlink',
    GameSummary = 'GameSummary',
    ERC20 = 'ERC20',
    Badge = 'Badge',
    Bridge = 'BridgePolygon',
    Whitelist = 'Whitelist',
    BUIDL = 'BUIDL',
    SkillTree = 'SkillTree',
    DETERMINISTIC_FACTORY_CONTRACT = 'DeterministicDeployFactory',
    LootDrop = 'LootDrop',
    HelloWorld = 'HelloWorld',
    RewardToken = 'RewardToken',
    DirectListingExtension = 'DirectListingExtension',
    MartinERC20 = 'MockERC20',
    Marketplace = 'Marketplace',
    EnglishAuctionsExtension = 'EnglishAuctionsExtension',
    OffersExtension = 'OffersExtension',
    AchievoProxyMarketplace = 'AchievoProxyMarketplace'
}

export enum CONTRACT_UPGRADABLE_NAME {
    LegacyAvatar = 'LegacyAvatarUpgradable',
    Avatars = 'AvatarsUpgradeable',
    Items = 'ItemsUpgradable',
    ItemsRoyaltiesV2 = 'ItemsRoyaltiesV2',
    Levels = 'LevelsUpgradable',
    PaymasterChainlink = 'PaymasterChainlinkUpgradable',
    ERC20 = 'BurnableTokenV1',
    Staker = 'ERC20StakeV1',
    Badge = 'BadgeUpgradable',
    BridgePolygon = 'BridgeUpgradeablePolygon',
    BridgeZkSync = 'BridgeUpgradeableZkSync',
    ZkSpork = 'ZkSpork',
    SkillTree = 'SkillTreeUpgradable',
    RewardItemsUpgradable = 'RewardItemsUpgradable',
    Marketplace = 'Marketplace',
}

export enum CONTRACT_EXTENSION_NAME {
    DirectListingExtension = 'DirectListingExtension',
    EnglishAuctionsExtension = 'EnglishAuctionsExtension'
}
