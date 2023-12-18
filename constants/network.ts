import dotenv from 'dotenv';

dotenv.config();

const { WEB3_INFURA_API_KEY } = process.env;

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
    ZkSyncGoerli = 280,
    ZkSyncSepolia = 300,
}

export enum NetworkName {
    Localhost = 'localhost',
    Ganache = 'ganache',
    Polygon = 'polygon',
    PolygonMumbai = 'polygonMumbai',
    Ethereum = 'mainnet',
    Goerli = 'goerli',
    Sepolia = 'sepolia',
    Mantle = 'Mantle',
    MantleWadsley = 'MantleWadsley',
    ZkSync = 'zkSync',
    ZkSyncGoerli = 'zkSyncGoerli',
    ZkSyncSepolia = 'zkSyncSepolia',
}

export enum Currency {
    Localhost = 'ETH',
    Ganache = 'ETH',
    Polygon = 'MATIC',
    PolygonMumbai = 'MATIC',
    Ethereum = 'ETH',
    Goerli = 'ETH',
    Mantle = 'MNT',
    MantleWadsley = 'MNT',
    ZkSync = 'ETH',
    ZkSyncGoerli = 'ETH',
    ZkSyncSepolia = 'ETH',
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
    ZkSyncGoerli = 'https://goerli.explorer.zksync.io',
    ZkSyncSepolia = 'https://sepolia.explorer.zksync.io',
}

export function getTransactionUrl(txHash: string, network: NetworkName): string {
    const explorerUrl = NetworkExplorer[network as keyof typeof NetworkExplorer];

    if (!explorerUrl) throw new Error(`Unsupported network: ${network}`);

    return `${explorerUrl}/tx/${txHash}`;
}

export const rpcUrls = {
    [ChainId.Ethereum]: `https://mainnet.infura.io/v3/${WEB3_INFURA_API_KEY}`,
    [ChainId.Goerli]: `https://goerli.infura.io/v3/${WEB3_INFURA_API_KEY}`,
    [ChainId.Sepolia]: `https://sepolia.infura.io/v3/${WEB3_INFURA_API_KEY}`,
    [ChainId.Polygon]: 'https://polygon.llamarpc.com',
    [ChainId.PolygonMumbai]: 'https://rpc.ankr.com/polygon_mumbai',
    [ChainId.MantleWadsley]: 'https://rpc.testnet.mantle.xyz',
    [ChainId.ZkSync]: 'https://mainnet.era.zksync.io',
    [ChainId.ZkSyncGoerli]: 'https://zksync2-testnet.zksync.dev',
    [ChainId.ZkSyncSepolia]: 'https://sepolia.era.zksync.dev',
};
