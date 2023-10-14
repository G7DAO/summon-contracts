import dotenv from 'dotenv';

dotenv.config();

const { WEB3_INFURA_API_KEY } = process.env;

export enum ChainId {
  Ganache = 1337,
  Polygon = 137,
  PolygonMumbai = 80001,
  Mantle = 5000,
  MantleWadsley = 5001,
  Goerli = 5,
  Ethereum = 1,
  ZkSync = 324,
  ZkSyncTestnet = 280,
}

export enum NetworkName {
  Localhost = 'localhost',
  Ganache = 'ganache',
  Polygon = 'polygon',
  PolygonMumbai = 'polygonMumbai',
  Goerli = 'goerli',
  Ethereum = 'mainnet',
  Mantle = 'Mantle',
  MantleWadsley = 'MantleWadsley',
  ZkSync = 'zkSync',
  ZkSyncTestnet = 'zkSyncTestnet',
}

export function getTransactionUrl(txHash: string, network: NetworkName): string {
  let explorerUrl: string;

  switch (network) {
    case NetworkName.Localhost:
      explorerUrl = 'http://localhost:8545';
      break;

    case NetworkName.Ganache:
      explorerUrl = 'http://localhost:7545';
      break;
    case NetworkName.Ethereum:
      explorerUrl = 'https://etherscan.io';
      break;
    case NetworkName.Goerli:
      explorerUrl = 'https://goerli.etherscan.io';
      break;
    case NetworkName.Polygon:
      explorerUrl = 'https://polygonscan.com';
      break;
    case NetworkName.PolygonMumbai:
      explorerUrl = 'https://mumbai.polygonscan.com';
      break;
    case NetworkName.MantleWadsley:
      explorerUrl = 'https://explorer.testnet.mantle.xyz';
      break;
    case NetworkName.Mantle:
      explorerUrl = 'https://explorer.testnet.mantle.xyz';
      break;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }

  return `${explorerUrl}/tx/${txHash}`;
}

export const rpcUrls = {
  [ChainId.Goerli]: `https://goerli.infura.io/v3/${WEB3_INFURA_API_KEY}`,
  [ChainId.Ethereum]: `https://mainnet.infura.io/v3/${WEB3_INFURA_API_KEY}`,
  [ChainId.Polygon]: 'https://polygon.llamarpc.com',
  [ChainId.PolygonMumbai]: 'https://rpc.ankr.com/polygon_mumbai',
  [ChainId.MantleWadsley]: 'https://rpc.testnet.mantle.xyz',
};
