export enum CONTRACT_TYPE {
    LegacyAvatar = 'LegacyAvatar',
    Avatars = 'Avatars',
    Items = 'Items',
    Levels = 'Levels',
    FreeMint = 'FreeMint',
    GameSummary = 'GameSummary',
    ERC20 = 'ERC20',
    Staker = 'Staker',
    Badges = 'Badges',
    Bridge = 'Bridge',
    Token = 'Token',
    Whitelist = 'Whitelist',
    SkillTree = 'SkillTree',
    DETERMINISTIC_FACTORY_CONTRACT = 'DeterministicDeployFactory',
    Rewards = 'Rewards',
    PaymentRouter = 'PaymentRouter',
    HelloWorld = 'HelloWorld',
    RewardAccessToken = 'RewardAccessToken',
    DirectListingExtension = 'DirectListingExtension',
    Marketplace = 'Marketplace',
    EnglishAuctionsExtension = 'EnglishAuctionsExtension',
    OffersExtension = 'OffersExtension',
    DirectListingsAddonExtension = 'DirectListingsAddonExtension',
    Forwarder = 'Forwarder',
}

export enum PROXY_CONTRACT_TYPE {
    EIP2535 = 'EIP2535',
    TransparentUpgradeableProxy = 'TransparentUpgradeableProxy',
    EIP1967 = 'EIP1967',
}

export enum CONTRACT_PROXY_CONTRACT_NAME {
    SummonProxy = 'SummonProxy',
    Diamond = 'Diamond',
    SummonProxyMarketplace = 'SummonProxyMarketplace',
}

export enum CONTRACT_PROXY_FILE_NAME {
    SummonProxy = 'SummonProxy',
    Diamond = 'Diamond',
}

export enum CONTRACT_FILE_NAME {
    GameSummary = 'GameSummary',
    Avatars = 'AvatarBound',
    ERC1155RoyaltiesSoulbound = 'ERC1155RoyaltiesSoulbound',
    Levels = 'LevelsBound',
    FreeMint = 'FreeMint',
    ERC1155Soulbound = 'ERC1155Soulbound',
    Bridge = 'ERC20Bridge',
    Whitelist = 'Whitelist',
    DETERMINISTIC_FACTORY_CONTRACT = 'DeterministicDeployFactory',
    Rewards = 'Rewards',
    HelloWorld = 'HelloWorld',
    AccessToken = 'AccessToken',
    DirectListingsExtension = 'DirectListingsLogic',
    ERC20 = 'MockERC20',
    Marketplace = 'Marketplace',
    EnglishAuctionsExtension = 'EnglishAuctionsLogic',
    OffersExtension = 'OffersLogic',
    DirectListingsAddonExtension = 'DirectListingsAddon',
    Martins = 'Martins',
    Forwarder = 'Forwarder',
    RewardsNative = 'RewardsNative',
    PaymentRouterNative = 'PaymentRouterNative',
    Distributor = 'Distributor'
}

export enum CONTRACT_UPGRADABLE_FILE_NAME {
    LegacyAvatar = 'LegacyAvatarUpgradeableV1',
    Avatars = 'AvatarBoundV1',
    ERC1155RoyaltiesSoulbound = 'ERC1155RoyaltiesSoulboundV2',
    Levels = 'LevelsBoundV1',
    ERC1155Soulbound = 'ERC1155SoulboundV1',
    Staker = 'ERC20StakeV1',
    Bridge = 'ERC20BridgeV1',
    BurnableToken = 'BurnableTokenV1',
    Marketplace = 'Marketplace',
}

export enum CONTRACT_UPGRADABLE_FILE_NAME_V2 {
    Avatars = 'AvatarBoundV2',
    ERC1155RoyaltiesSoulbound = 'ERC1155RoyaltiesSoulboundV2',
    Levels = 'LevelsBoundV2',
    ERC1155Soulbound = 'ERC1155SoulboundV2',
}

export enum CONTRACT_NAME {
    Avatars = 'Avatars',
    Items = 'Items',
    Levels = 'Levels',
    FreeMint = 'FreeMint',
    GameSummary = 'GameSummary',
    ERC20 = 'ERC20',
    Badge = 'Badge',
    Bridge = 'BridgePolygon',
    Whitelist = 'Whitelist',
    BUIDL = 'BUIDL',
    SkillTree = 'SkillTree',
    DETERMINISTIC_FACTORY_CONTRACT = 'DeterministicDeployFactory',
    Rewards = 'Rewards',
    HelloWorld = 'HelloWorld',
    RewardAccessToken = 'RewardAccessToken',
    RewardAccessTokenG7 = 'RewardAccessTokenG7',
    DirectListingExtension = 'DirectListingExtension',
    MartinsToken = 'Martins',
    Marketplace = 'Marketplace',
    EnglishAuctionsExtension = 'EnglishAuctionsExtension',
    OffersExtension = 'OffersExtension',
    SummonProxyMarketplace = 'SummonProxyMarketplace',
    DirectListingsAddonExtension = 'DirectListingsAddonExtension',
    Staker = 'Staker',
    MiddlewareStaker = 'MiddlewareStakerG7',
    Forwarder = 'Forwarder',
    RewardsNativeG7 = 'RewardsNativeG7',
    PaymentRouterNativeG7 = 'PaymentRouterNativeG7',
    CamelotDistributor = 'CamelotDistributor'
}

export enum CONTRACT_UPGRADABLE_NAME {
    LegacyAvatar = 'LegacyAvatarUpgradable',
    Avatars = 'AvatarsUpgradeable',
    Items = 'ItemsUpgradeable',
    Badges = 'BadgesUpgradeable',
    ItemsRoyaltiesV2 = 'ItemsRoyaltiesV2',
    Levels = 'LevelsUpgradeable',
    ERC20 = 'BurnableTokenV1',
    Staker = 'ERC20StakeV1',
    BridgePolygon = 'BridgeUpgradeablePolygon',
    ZkSpork = 'ZkSpork',
    SkillTree = 'SkillTreeUpgradeable',
    Marketplace = 'Marketplace',
    MiddlewareStaker = 'MiddlewareStakerNativeTokenV1',
}

export enum CONTRACT_EXTENSION_NAME {
    DirectListingExtension = 'DirectListingExtension',
    EnglishAuctionsExtension = 'EnglishAuctionsExtension',
}
