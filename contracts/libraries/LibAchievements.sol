// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

library LibAchievements {

    bytes32 constant STORAGE_POSITION =
    keccak256("achievo.eth.storage.Achievements");

    struct TokenData {
        address owner;
        bool soulbounded;
        bool blackListed;
    }

    struct AchievementsStorage {
        address Admin;
        mapping(uint256 => TokenData) tokenData;
    }

    function achievementsStorage()
    internal
    pure
    returns (AchievementsStorage storage astore)
    {
        bytes32 position = STORAGE_POSITION;
        assembly {
            astore.slot := position
        }
    }
}
