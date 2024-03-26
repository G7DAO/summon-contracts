import dotenv from 'dotenv';

dotenv.config();

const { INFURA_API_KEY } = process.env;

export enum NETWORK_TYPE {
    MAINNET = 'MAINNET',
    TESTNET = 'TESTNET',
}

export enum ChainId {
    Ganache = 1337,
    Polygon = 137,
    PolygonMumbai = 80001,
    Mantle = 5000,
    MantleWadsley = 5001,
    Ethereum = 1,
    Goerli = 5,
    Sepolia = 11155111,
    ZkSync = 324,
    ZkSyncSepolia = 300,
    ArbitrumOne = 42161,
    ArbitrumSepolia = 421614,
}

export enum NetworkName {
    Localhost = 'localhost',
    Ganache = 'ganache',
    Polygon = 'polygon',
    PolygonMumbai = 'polygonMumbai',
    Ethereum = 'mainnet',
    Goerli = 'goerli',
    Sepolia = 'sepolia',
    Mantle = 'mantle',
    MantleWadsley = 'mantleWadsley',
    ZkSync = 'zkSync',
    ZkSyncSepolia = 'zkSyncSepolia',
    ArbitrumOne = 'arbitrumOne',
    ArbitrumSepolia = 'arbitrumSepolia',
}

export enum NetworkConfigFile {
    DEFAULT = 'hardhat.config.ts',
    Localhost = 'hardhat.config.ts',
    Ganache = 'hardhat.config.ts',
    Polygon = 'polygon.config.ts',
    PolygonMumbai = 'polygon.config.ts',
    Ethereum = 'hardhat.config.ts',
    Goerli = 'hardhat.config.ts',
    Sepolia = 'hardhat.config.ts',
    Mantle = 'mantle.config.ts',
    MantleWadsley = 'mantle.config.ts',
    ZkSync = 'zkSync.config.ts',
    ZkSyncSepolia = 'zkSync.config.ts',
    ArbitrumOne = 'arbitrum.config.ts',
    ArbitrumSepolia = 'arbitrum.config.ts',
}

export enum Currency {
    Localhost = 'ETH',
    Ganache = 'ETH',
    Polygon = 'MATIC',
    PolygonMumbai = 'MATIC',
    Ethereum = 'ETH',
    Goerli = 'ETH',
    Sepolia = 'ETH',
    Mantle = 'MNT',
    MantleWadsley = 'MNT',
    ZkSync = 'ETH',
    ZkSyncSepolia = 'ETH',
    ArbitrumOne = 'ETH',
    ArbitrumSepolia = 'ETH',
}

export enum NetworkExplorer {
    Localhost = 'http://localhost:8545',
    Ganache = 'http://localhost:7545',
    Polygon = 'https://polygonscan.com',
    PolygonMumbai = 'https://mumbai.polygonscan.com',
    Ethereum = 'https://etherscan.io',
    Goerli = 'https://goerli.etherscan.io',
    Sepolia = 'https://sepolia.etherscan.io',
    Mantle = 'https://explorer.testnet.mantle.xyz',
    MantleWadsley = 'https://explorer.testnet.mantle.xyz',
    ZkSync = 'https://explorer.zksync.io',
    ZkSyncSepolia = 'https://sepolia.explorer.zksync.io',
    ArbitrumOne = 'https://arbiscan.io',
    ArbitrumSepolia = 'https://sepolia.arbiscan.io',
}

export function getTransactionUrl(txHash: string, network: NetworkName): string {
    const explorerUrl = NetworkExplorer[network as unknown as keyof typeof NetworkExplorer];

    if (!explorerUrl) throw new Error(`Unsupported network: ${network}`);

    return `${explorerUrl}/tx/${txHash}`;
}

export const rpcUrls = {
    [ChainId.Ethereum]: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
    [ChainId.Goerli]: `https://goerli.infura.io/v3/${INFURA_API_KEY}`,
    [ChainId.Sepolia]: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
    [ChainId.Polygon]: 'https://polygon.llamarpc.com',
    [ChainId.PolygonMumbai]: 'https://rpc.ankr.com/polygon_mumbai',
    [ChainId.Mantle]: 'https://rpc.mantle.xyz',
    [ChainId.MantleWadsley]: 'https://rpc.testnet.mantle.xyz',
    [ChainId.ZkSync]: 'https://mainnet.era.zksync.io',
    [ChainId.ZkSyncSepolia]: 'https://sepolia.era.zksync.dev',
    [ChainId.ArbitrumOne]: 'https://arb1.arbitrum.io/rpc',
    [ChainId.ArbitrumSepolia]: 'https://sepolia-rollup.arbitrum.io/rpc',
};
