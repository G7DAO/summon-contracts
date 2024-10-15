import { CONTRACT_NAME, CONTRACT_UPGRADABLE_NAME } from './contract';
import { ChainId } from './network';

const MAR20_G7_TESTNET = '0xd7CD332586D29bD7b9CBdB1ed38BD080C7BFeBC9';
const G7_NATIVE_TESTNET_TOKEN = '0x10adBf84548F923577Be12146eAc104C899D1E75';

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
        contractURI: 'https://summon.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        revealURI: 'Qmdk4zHamwCyqSzuWNNYypuz4FXAGdApbky7SHNsXYYQg7',
        compoundURI: 'https://web3.cdn.summon.xyz/v2/uri/avatar',
        devWallet: 'DEPLOYER_WALLET',
        gatingNftAddress: '0xD07180c423F9B8CF84012aA28cC174F3c433EE29',
        itemsNftAddress: `CONTRACT_${CONTRACT_NAME.Items}`,
        mintNftGatingEnabled: true,
        mintNFtWithoutGatingEnabled: true,
        mintRandomItemEnabled: true,
        mintSpecialItemEnabled: true,
    },
    TESTNET: {
        name: 'AvatarBound',
        symbol: 'AVB',
        baseURI: '',
        contractURI: 'https://achievo.mypinata.cloud/ipfs/QmSDbeNWVY2CGUuLHni689L5eSrSG3iZHyTRZJWXX7GpjS',
        revealURI: 'QmZnvSyeKRQxWwcofVmq41BNCtHbBmomk8Ny8mtGRTjtzS',
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
        name: 'LevelsBound',
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
    },
    TESTNET: {
        _devWallet: 'DEPLOYER_WALLET',
        _managerWallet: 'DEPLOYER_WALLET',
        _minterWallet: 'DEPLOYER_WALLET',
        _rewardTokenAddress: `CONTRACT_${CONTRACT_NAME.RewardToken}`,
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

export const RewardTokenArgs = {
    MAINNET: {
        _name: 'RewardToken',
        _symbol: 'RT',
        _defaultTokenURI: 'FILL_ME',
        _contractURI: 'FILL_ME',
        _devWallet: 'DEPLOYER_WALLET',
        _lootDropAddress: `CONTRACT_${CONTRACT_NAME.Rewards}`,
    },
    TESTNET: {
        _name: 'RainToken',
        _symbol: 'RT',
        _defaultTokenURI: 'FILL_ME',
        _contractURI: 'FILL_ME',
        _devWallet: 'DEPLOYER_WALLET',
        _lootDropAddress: `CONTRACT_${CONTRACT_NAME.Rewards}`,
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
