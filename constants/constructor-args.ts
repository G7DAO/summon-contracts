import { CONTRACT_NAME, CONTRACT_UPGRADABLE_NAME } from './contract';
import { ChainId } from './network';

const MAR20_G7_TESTNET = '0xd7CD332586D29bD7b9CBdB1ed38BD080C7BFeBC9';
const G7_NATIVE_TESTNET_TOKEN = '0x10adBf84548F923577Be12146eAc104C899D1E75';
const TESTNET_UDCE_TOKEN = '0xD73EbC44643B594e44Ab46202590458c9606A709';
const TESTNET_DEV_WALLET = '0x60b6f7B5F31331CD8c16b1328023ed088E82f85f';
const TESTNET_CHIPS_CONTRACT = '0xc5A563F1d671ee1Ec3819EC96F06A6b19645E08e';
const TESTNET_TREASURY_WALLET = '0x9ed191DB1829371F116Deb9748c26B49467a592A';
const MOCK_USDC_ARB_SEPOLIA = '0x39B29A0Da967CDd29B45e4f942086839795c32B0';
const USDC_ARBITRUM_ONE = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const USDT_ARBITRUM_ONE = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
const USDC_ARBITRUM_SEPOLIA = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
const GUNITS_ARBITRUM_SEPOLIA = '0x3E3a445731d7881a3729A3898D532D5290733Eb5';
const GUNITS_ARBITRUM_ONE = '0x3E3a445731d7881a3729A3898D532D5290733Eb5';
const USDXM_ARBITRUM_SEPOLIA = '0x14196F08a4Fa0B66B7331bC40dd6bCd8A1dEeA9F'

export interface ConstructorArgs {
    name: string;
    symbol: string;
    baseURI: string;
    contractURI: string;
    maxPerMint: number;
    isPaused: boolean;
    devWallet: string;
    royalty?: number;
}

export interface Soulbound1155Args {
    MAINNET: ConstructorArgs;
    TESTNET: ConstructorArgs;
}

export const ItemBoundArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'G7Items',
        symbol: 'G7I',
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/QmVrRk9RcwhWXXhxiFts6qUVjSr6mhqphr77vTxQCv7yKM',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'G7Items',
        symbol: 'ISB',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmVrRk9RcwhWXXhxiFts6qUVjSr6mhqphr77vTxQCv7yKM',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
};

export const AvatarBoundArgs = {
    MAINNET: {
        name: 'Game7Avatar',
        symbol: 'G7A',
        baseURI: '',
        contractURI: 'https://summon.mypinata.cloud/ipfs/QmTZ9GJ37iPZ61TeQaUpqTtY3Mg3yJAr3ZmfRepcqYPj4h',
        revealURI: '',
        compoundURI: 'https://web3.cdn.summon.xyz/v2/uri/avatar',
        devWallet: 'DEPLOYER_WALLET',
        gatingNftAddress: '0xD07180c423F9B8CF84012aA28cC174F3c433EE29',
        itemsNftAddress: `CONTRACT_${CONTRACT_NAME.Items}`,
        mintNftGatingEnabled: false,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: false,
    },
    TESTNET: {
        name: 'TestnetAvatarBound',
        symbol: 'TAVB',
        baseURI: '',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmTZ9GJ37iPZ61TeQaUpqTtY3Mg3yJAr3ZmfRepcqYPj4h',
        revealURI: '',
        compoundURI: 'https://web3-staging.cdn.summon.xyz/v2/uri/avatar',
        devWallet: 'DEPLOYER_WALLET',
        gatingNftAddress: '0x6E03Ea6c9aBBb78Dd761b9c71c06176c508488C3',
        itemsNftAddress: `CONTRACT_${CONTRACT_NAME.Items}`,
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
    },
};

export const AvatarBoundV1Args = {
    MAINNET: {
        ...AvatarBoundArgs.MAINNET,
        itemsNftAddress: `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`,
    },
    TESTNET: {
        ...AvatarBoundArgs.TESTNET,
        itemsNftAddress: `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`,
    },
};

export const LevelsBoundArgs = {
    MAINNET: {
        name: 'Game7Level',
        symbol: 'LVL',
        developerAdmin: 'DEPLOYER_WALLET',
        mintRandomItemEnabled: true,
        itemsNFTAddress: `CONTRACT_${CONTRACT_NAME.Items}`,
    },
    TESTNET: {
        name: 'LevelsBound',
        symbol: 'LVL',
        developerAdmin: 'DEPLOYER_WALLET',
        mintRandomItemEnabled: true,
        itemsNFTAddress: `CONTRACT_${CONTRACT_NAME.Items}`,
    },
};

export const LevelsBoundV1Args = {
    MAINNET: {
        ...LevelsBoundArgs.MAINNET,
        itemsNFTAddress: `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`,
    },
    TESTNET: {
        ...LevelsBoundArgs.TESTNET,
        itemsNFTAddress: `CONTRACT_${CONTRACT_UPGRADABLE_NAME.Items}`,
    },
};

export const OpenMintArgs = {
    MAINNET: {
        name: 'OpenMint-TEST',
        symbol: 'OM_TEST',
        baseTokenURI: 'https://summon.mypinata.cloud/ipfs/',
        unrevealedURI: 'Qmc7c9tNVaaAbTM5RMgdPY7MjPoLDFfPw8BAv3WuBUrebe',
    },
    TESTNET: {
        name: 'OpenMint-TEST',
        symbol: 'OM_TEST',
        baseTokenURI: 'https://achievo.mypinata.cloud/ipfs/',
        unrevealedURI: 'Qmc7c9tNVaaAbTM5RMgdPY7MjPoLDFfPw8BAv3WuBUrebe',
    },
};

export const GameSummaryArgs = {
    MAINNET: {
        _name: 'GameSummary',
        _symbol: 'GS',
        _defaultTokenURI: 'FILL_ME',
        _contractURI: 'FILL_ME',
        _compoundURI: 'https://web3.cdn.summon.xyz/v2/uri/achievements',
        _maxPerMint: 1,
        _isPaused: false,
        _devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        _name: 'GameSummary',
        _symbol: 'GS',
        _defaultTokenURI: 'FILL_ME',
        _contractURI: 'FILL_ME',
        _compoundURI: 'https://web3-staging.cdn.summon.xyz/v2/uri/achievements',
        _maxPerMint: 1,
        _isPaused: false,
        _devWallet: 'DEPLOYER_WALLET',
    },
};

export const ZKSSPorkV1Args = {
    MAINNET: {
        name: 'ZkSSpork',
        symbol: 'ZkSS',
        developerAdmin: 'DEPLOYER_WALLET',
        decimals: 18,
        regularToken: '0x8A9074144C5041f90330Fef6E2fE96A0593Ebc3f',
    },
    TESTNET: {
        name: 'ZkSSpork',
        symbol: 'ZkSS',
        developerAdmin: 'DEPLOYER_WALLET',
        decimals: 18,
        regularToken: 'FILL_ME',
    },
};

export const BridgePolygonV1Args = {
    MAINNET: {
        developerAdmin: 'DEPLOYER_WALLET',
        chainIdFrom: ChainId.Polygon,
        chainIdTo: ChainId.Game7Testnet, // TODO * chain to mainnet
    },
    TESTNET: {
        developerAdmin: 'DEPLOYER_WALLET',
        chainIdFrom: ChainId.PolygonMumbai,
        chainIdTo: ChainId.Game7Testnet,
    },
};

export const WhitelistArgs = {
    MAINNET: {
        developerAdmin: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        developerAdmin: 'DEPLOYER_WALLET',
    },
};

export const BurnableTokenV1Args = {
    MAINNET: {
        name: 'SPORK',
        symbol: 'SPORK',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'SPORK',
        symbol: 'SPORK',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
};

export const BadgeBoundArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'Item',
        symbol: 'ISB',
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'Badge',
        symbol: 'BADGE',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
};

export const SkillTreeArgs: Soulbound1155Args = {
    MAINNET: {
        name: 'SkillTree',
        symbol: 'STSB',
        baseURI: 'https://summon.mypinata.cloud/ipfs',
        contractURI: 'https://summon.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'SkillTree',
        symbol: 'STSB',
        baseURI: 'https://achievo.mypinata.cloud/ipfs',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        maxPerMint: 1,
        isPaused: false,
        devWallet: 'DEPLOYER_WALLET',
    },
};

export const BUIDLArgs = {
    MAINNET: {
        name: 'BUIDL',
        symbol: 'BUIDL',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'MOCKERC20',
        symbol: 'ERC20',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
};

export const ERC20Args = {
    MAINNET: {},
    TESTNET: {},
};

export const ERC20DecimalsAgs = {
    MAINNET: {
        name: 'FILL_ME',
        symbol: 'FILL_ME',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        name: 'MOCKERC20',
        symbol: 'ERC20',
        decimals: 18,
        developerAdmin: 'DEPLOYER_WALLET',
    },
};

export const RewardsArgs = {
    MAINNET: {
        _devWallet: '0x85f56764F58F595D08252b98942554bFB5Eea390',
        _managerWallet: 'FAIL',
        _minterWallet: 'FAIL',
        _rewardTokenAddress: `CONTRACT_${CONTRACT_NAME.RewardAccessTokenG7}`,
    },
    TESTNET: {
        _devWallet: 'DEPLOYER_WALLET',
        _managerWallet: 'DEPLOYER_WALLET',
        _minterWallet: 'DEPLOYER_WALLET',
        _rewardTokenAddress: `CONTRACT_${CONTRACT_NAME.RewardAccessToken}`,
    },
};

export const RewardsNativeG7Args = {
    MAINNET: {
        _devWallet: '0x85f56764F58F595D08252b98942554bFB5Eea390',
        _adminWallet: '0x85f56764F58F595D08252b98942554bFB5Eea390',
        _managerWallet: '0x85f56764F58F595D08252b98942554bFB5Eea390',
        _minterWallet: '0x85f56764F58F595D08252b98942554bFB5Eea390',
        _rewardTokenAddress: `CONTRACT_${CONTRACT_NAME.RewardAccessTokenG7}`,
    },
    TESTNET: {
        _devWallet: 'DEPLOYER_WALLET',
        _adminWallet: 'DEPLOYER_WALLET',
        _managerWallet: 'DEPLOYER_WALLET',
        _minterWallet: 'DEPLOYER_WALLET',
        _rewardTokenAddress: `CONTRACT_${CONTRACT_NAME.RewardAccessTokenG7}`,
    },
};

export const PaymentRouterNativeG7Args = {
    // TODO: fill this args for mainnet
    MAINNET: {
        manager: '0x85f56764F58F595D08252b98942554bFB5Eea390',
        adminWallet: '0x85f56764F58F595D08252b98942554bFB5Eea390',
    },
    TESTNET: {
        manager: '0x4d790f180C71029F983c0A70901E3DcA1aAe12f5',
        adminWallet: '0x4d790f180C71029F983c0A70901E3DcA1aAe12f5',
    },
};

export const HelloWorldArgs = {
    MAINNET: {
        randomNumber: 12312,
    },
    TESTNET: {
        randomNumber: 232323,
    },
};

export const CamelotDistributorArgs = {
    MAINNET: {
        owner: '0x4d790f180C71029F983c0A70901E3DcA1aAe12f5',
        updater: '0x4d790f180C71029F983c0A70901E3DcA1aAe12f5',
        wNative: '0x4d790f180C71029F983c0A70901E3DcA1aAe12f5',
    },
    TESTNET: {
        owner: '0x4d790f180C71029F983c0A70901E3DcA1aAe12f5',
        updater: '0x4d790f180C71029F983c0A70901E3DcA1aAe12f5',
        wNative: '0x4d790f180C71029F983c0A70901E3DcA1aAe12f5',
    },
};

export const RewardTokenArgs = {
    MAINNET: {
        _name: 'AccessToken',
        _symbol: 'AT',
        _defaultTokenURI: 'NO_VALUE',
        _contractURI: 'NO_VALUE',
        _devWallet: 'DEPLOYER_WALLET',
        _rewardAddress: `CONTRACT_${CONTRACT_NAME.Rewards}`,
    },
    TESTNET: {
        _name: 'AccessToken',
        _symbol: 'AT',
        _defaultTokenURI: 'NO_VALUE',
        _contractURI: 'NO_VALUE',
        _devWallet: 'DEPLOYER_WALLET',
        _rewardAddress: `CONTRACT_${CONTRACT_NAME.Rewards}`,
    },
};

export const GUnitsArgs = {
    TESTNET: {
        _token: TESTNET_UDCE_TOKEN,
        _isPaused: false,
        _devWallet: TESTNET_DEV_WALLET,
    },
    ARBITRUM_SEPOLIA: {
        _token: USDXM_ARBITRUM_SEPOLIA,
        _isPaused: false,
        _devWallet: TESTNET_DEV_WALLET,
    },
    ARBITRUM_ONE: {
        _token: USDC_ARBITRUM_ONE,
        _isPaused: false,
        _devWallet: 'DEPLOYER_WALLET',
    },
};

export const GReceiptsArgs = {
    ARBITRUM_SEPOLIA: {
        _gUnits: GUNITS_ARBITRUM_SEPOLIA,
        _paymentToken: USDC_ARBITRUM_SEPOLIA,
        _isPaused: false,
        _devWallet: TESTNET_DEV_WALLET,
    },
    ARBITRUM_ONE: {
        _gUnits: GUNITS_ARBITRUM_ONE,
        _paymentToken: USDC_ARBITRUM_ONE,
        _isPaused: false,
        _devWallet: 'DEPLOYER_WALLET',
    },
};

export const AccessTokenG7Args = {
    MAINNET: {
        _devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        _devWallet: 'DEPLOYER_WALLET',
    },
};

export const DirectListingExtensionArgs = {
    MAINNET: {
        // _tokenAddress: 'FILL_ME',
        // _devWallet: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        _tokenAddress: MAR20_G7_TESTNET,
        _devWallet: 'DEPLOYER_WALLET',
    },
};

export const DirectListingAddonArgs = {
    MAINNET: {
        // _tokenAddress: 'FILL_ME',
    },
    TESTNET: {
        _tokenAddress: MAR20_G7_TESTNET,
    },
};

export const MarketplaceArgs = {
    MAINNET: {
        extensions: [],
        royaltyEngineAddress: 'FILL_ME',
        nativeTokenWrapper: 'FILL_ME',
    },
    TESTNET: {
        extensions: [],
        royaltyEngineAddress: 'ZERO_ADDRESS',
        nativeTokenWrapper: G7_NATIVE_TESTNET_TOKEN,
    },
};

export const StakerArgs = {
    MAINNET: {
        stakerContract: `CONTRACT_${CONTRACT_NAME.PositionMetadata}`,
    },
    TESTNET: {
        stakerContract: `CONTRACT_${CONTRACT_NAME.PositionMetadata}`,
    },
};

export const MiddlewareNativeTokenStakerArgs = {
    MAINNET: {
        stakerContract: undefined,
        admin: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        stakerContract: '0xE7e669769Bb409b31540ff5dB6F15af3307928b1',
        admin: 'DEPLOYER_WALLET',
    },
};

export const ForwarderArgs = {
    MAINNET: {
        parentWallet: 'DEPLOYER_WALLET',
        admin: 'DEPLOYER_WALLET',
    },
    TESTNET: {
        parentWallet: 'DEPLOYER_WALLET',
        admin: 'DEPLOYER_WALLET',
    },
};

export const EnglishAuctionsExtensionArgs = {
    MAINNET: {
        // _nativeTokenWrapper: 'FILL_ME',
    },
    TESTNET: {
        _nativeTokenWrapper: G7_NATIVE_TESTNET_TOKEN,
    },
};

export const OffersExtensionArgs = {
    MAINNET: {},
    TESTNET: {},
};
