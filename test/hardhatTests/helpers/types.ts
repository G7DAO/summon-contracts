export type AuctionParameters = {
    assetContract: string;
    tokenId: number;
    quantity: number;
    currency: string;
    minimumBidAmount: bigint;
    buyoutBidAmount: bigint;
    timeBufferInSeconds: number;
    bidBufferBps: number;
    startTimestamp: number;
    endTimestamp: number;
};

export enum TokenType {
    ERC721,
    ERC1155
}

export enum AuctionStatus {
    UNSET,
    CREATED,
    COMPLETED,
    CANCELLED
}

export type Auction = {
    auctionId: bigint;
    tokenId: number;
    quantity: number;
    minimumBidAmount: bigint;
    buyoutBidAmount: bigint;
    timeBufferInSeconds: number;
    bidBufferBps: number;
    startTimestamp: number;
    endTimestamp: number;
    auctionCreator: string;
    assetContract: string;
    currency: string;
    tokenType: TokenType;
    status: AuctionStatus;
}