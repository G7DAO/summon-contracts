// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// @author summon Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @vasinl124]
//....................................................................................................................................................
//....................&&&&&&..........................................................................................................................
//..................&&&&&&&&&&&.......................................................................................................................
//..............X.....&&&&&&&&&&&&....................................................................................................................
//............&&&&&&.....&&&&&&&&&&&..................................................................................................................
//............&&&&&&&&&.....&&&&&.....................................................................................................................
//............&&&&&&&&&&&&.........&.............&&&&&&&&&&&&..&&&&....&&&&.&&&&&&&&..&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&&&&&.&&&&&....&&&&...........
//...............&&&&&&&&&&&&.....&&$............&&&&..........&&&&....&&&&.&&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&.&&&&&&&&&&&&.&&&&&&&..&&&&...........
//............&.....&&&&&&&&&&&&..................&&&&&&&&&&&..&&&&....&&&&.&&&&..&&&&&&.&&&&..&&&&.&&&&&&..&&&&.&&&&....&&&&.&&&&.&&&&&&&&...........
//............&&.......&&&&&&&&&&&&......................&&&&..&&&&&&&&&&&&.&&&&..&&&&&..&&&&..&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&...&&&&&&...........
//................&&&.....&&&&&&&&&&+............&&&&&&&&&&&&...&&&&&&&&&&..&&&&...&&&&..&&&&.&&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&....&&&&&...........
//.............&&&&&&&&&.....&&&&&&&..................................................................................................................
//.............&&&&&&&&&&&&.....&&&...................................................................................................................
//.................&&&&&&&&&&&........................................................................................................................
//....................&&&&&&&.........................................................................................................................
//....................................................................................................................................................

library LibItems {
    struct Tier {
        uint256 tierId;
        string tierName;
    }

    enum RewardType {
        ETHER,
        ERC20,
        ERC721,
        ERC1155
    }

    struct RewardTokenOld {
        uint256 tokenId;
        string tokenUri;
        uint256 rewardAmount; // depending of the erc20 token decimal
        address rewardERC20; // USDC, USDT, DAI, etc
        bool isEther;
    }

    struct Reward {
        RewardType rewardType; // 0 = ether 1 = erc20, 2 = erc721, 3 = erc1155, 4 = erc404
        uint256 rewardAmount; // depending of the erc20 token decimal
        address rewardTokenAddress; // ether is 0x0, USDC, USDT, DAI, NFT, etc
        uint256[] rewardTokenIds; // erc721
        uint256 rewardTokenId; // erc1155
    }

    struct RewardToken {
        uint256 tokenId;
        string tokenUri;
        Reward[] rewards;
        uint256 maxSupply; // 0 mean unlimited
    }

    struct TokenCreateLegacy {
        uint256 tokenId;
        string tokenUri;
    }

    struct TokenCreate {
        uint256 tokenId;
        string tokenUri;
        address receiver;
        uint256 feeBasisPoints;
    }

    struct TokenReturn {
        uint256 tokenId;
        string tokenUri;
        uint256 amount;
    }
}

library TestLibItems {
    enum Tier {
        NONE,
        COMMON,
        UNCOMMON,
        RARE,
        LEGENDARY,
        MYTHICAL
    }
}
