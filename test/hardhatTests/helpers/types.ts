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
    ERC1155,
    ERC20
}

export enum Status {
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
    status: Status;
}

export type OfferParams = {
    assetContract: string;
    tokenId: number;
    quantity: number;
    currency: string;
    totalPrice: bigint;
    expirationTimestamp: number;
}

/*
struct Offer {
    uint256 offerId;
    uint256 tokenId;
    uint256 quantity;
    uint256 totalPrice;
    uint256 expirationTimestamp;
    address offeror;
    address assetContract;
    address currency;
    TokenType tokenType;
    Status status;
}*/

export type Offer = {
    offerId: bigint;
    tokenId: number;
    quantity: number;
    totalPrice: bigint;
    expirationTimestamp: number;
    offeror: string;
    assetContract: string;
    currency: string;
    tokenType: TokenType;
    status: Status;
}
