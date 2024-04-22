// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// MMMMNkc. .,oKWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MWXd,.      .cONMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// Wx'           .cKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// x.              ;KMMMMMMMMMMMMWKxlcclxKWMMMMMMMMWKxlc::::::::ckWMMXd:cOMMMMMMMMKo:oKMMWkccxWMWKdccccccccccccoKMM0l:l0MMMMMMMMMWkc:dXMMMXkoc::::::clxKW
// '                lNMMMMMMMMMMNd.  ..  .dNMMMMMMNd.  ..........oWMM0'  oWMMMMMMMk. .kMMN:  :XMNl   .''''''''';OMMX:  ,0MMMMMMMWk.  oNMWk'  ........  .o
// .                :XMMMMMMMMMWd. .o00l. .dWMMMMWx. .o0KKXKKXXXXNMMM0'  oNWWWWWWWk. .kMMN:  :NMNc  .kNNNNNNNNNNWMMM0,  :XMMMMMM0,  cXMMO.  c0KKKKXK0o.
// , .lkxo.  ;dkx,  oWMMMMMMMMWk.  oNMMNo. .kWMMMWl  ;KMMMMMMMMMMMMMM0'  .',',,,,,.  .kMMN:  :NMNc   ,:;;;;;;dXMMMMMMO.  lNMMMMK:  ;KMMMd. .OMMMMMMMMX;
// :  :KWX: .xMWx. .kMMMMMMMMM0'  cXMMMMXc  ,0MMMWl  ;KMMMMMMMMMMMMMM0'  .',,'',,,.  .kMMN:  :NMNc   ',,;;,;;oXMMMMMMWx. .dWMMNc  'OMMMMd. .OMMMMMMMMX;
// l   ,0WO:oXWd.  .OMMMMMMMMK;  ;KMMMMMMK;  :KMMWd. .o0KKXXKKKXXNMMM0'  oNWWWWWWWx. .kMMN:  :XMNc  .kNNNNNNNNWWWMMMMMNo. .dK0l. .xWMMMMO. .c0KKKXXK0o.
// o    dWMWWMK,   '0MMMMMMMXc  'OMMMMMMMMO'  cNMMNd.  ..........oWMM0'  oWMMMMMMMk. .kMMN:  :XMNl   .,,,,,,,,,:0MMMMMMNo.  ..  'xWMMMMMWx'   .......  .o
// O'   :XMMMMk.   cXMMMMMMMKo:cOWMMMMMMMMWOc:oKMMMWKxlc::::::::ckWMMXd:cOMMMMMMMMKo:oKMMWkc:xWMWKoc:::::::::::lKMMMMMMMWKdlcclxXWMMMMMMMMXkoc::::::clxKW
// WO;  'OMMMWl  .oXMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MMNx'.dWMMK;.:0WMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM
// MMMM0cdNMM0cdNMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM

/**
 * Authors: Omar Garcia
 * GitHub: https://github.com/ogarciarevett
 */

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// This contract contains only the phase 1 of the GameSummaries contract
contract GameSummary is ERC1155, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant GAME_CREATOR_ROLE = keccak256("GAME_CREATOR_ROLE");

    event GameSummaryUpdated(address indexed indexer, uint256 indexed tokenId);
    event GameSummaryMinted(address indexed player, uint256 indexed gameId, uint256 totalAchievements);
    event PlayerGameSummaryMinted(address indexed player, uint256 indexed gameId, uint256 achievements);
    event PlayerGameSummaryUpdated(address indexed player, uint256 indexed gameId, uint256 achievements);
    event SignerAdded(address signer);
    event SignerRemoved(address signer);
    event GameSummaryMintedPaused(bool paused);

    string public baseUri;

    struct GameSummary {
        uint256 tokenId;
        uint256 storeId;
        uint256 gameId;
        string name;
        string image;
        string externalURI;
        uint256 totalAchievements;
    }

    struct PlayerGameData {
        uint256 tokenId;
        uint256 achievementsMinted;
        bool soulbounded;
    }

    // tokenId(storeId+0+gameId) => common game data
    mapping(uint256 => GameSummary) public commonGameSummaries;

    // player address => tokenId(storeId+0+gameId) => player game data
    mapping(address => mapping(uint256 => PlayerGameData)) public playerGameData;

    mapping(address => bool) public whitelistSigners;

    // bytes(signature) => used
    mapping(bytes => bool) public usedSignatures;

    modifier onlyOnceSignature(bytes memory signature) {
        require(usedSignatures[signature] != true, "Signature and nonce already used");
        _;
    }

    constructor(string memory _uri) ERC1155(_uri) {
        baseUri = _uri;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getTokenId(uint256 storeId, uint256 gameId) public pure returns (uint256) {
        uint256 tokenId = uint256(keccak256(abi.encode(storeId, gameId)));
        return tokenId;
    }

    function setBaseUri(string memory _uri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        baseUri = _uri;
    }

    function setSigner(address _signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[_signer] = true;
        emit SignerAdded(_signer);
    }

    function removeSigner(address signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[signer] = false;
        emit SignerRemoved(signer);
    }

    function recoverAddress(uint256 nonce, bytes memory signature) private view returns (address) {
        bytes32 message = keccak256(abi.encodePacked(msg.sender, nonce));
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(hash, signature);
        return signer;
    }

    function verifySignature(uint256 nonce, bytes memory signature) private returns (bool) {
        address signer = recoverAddress(nonce, signature);
        if (whitelistSigners[signer]) {
            usedSignatures[signature] = true;
            return true;
        } else {
            return false;
        }
    }

    function getGameSummary(uint256 tokenId) public view returns (GameSummary memory) {
        return commonGameSummaries[tokenId];
    }

    function getGameSummaries(uint256[] calldata tokenIds) public view returns (GameSummary[] memory) {
        GameSummary[] memory summaries = new GameSummary[](tokenIds.length);
        for (uint i = 0; i < tokenIds.length; i++) {
            summaries[i] = commonGameSummaries[tokenIds[i]];
        }
        return summaries;
    }

    function getPlayerGameData(address player, uint256 tokenId) public view returns (PlayerGameData memory) {
        return playerGameData[player][tokenId];
    }

    function getPlayerGamesData(
        address player,
        uint256[] calldata tokenIds
    ) public view returns (PlayerGameData[] memory) {
        PlayerGameData[] memory playerGamesData = new PlayerGameData[](tokenIds.length);
        for (uint i = 0; i < tokenIds.length; i++) {
            playerGamesData[i] = playerGameData[player][tokenIds[i]];
        }
        return playerGamesData;
    }

    function updateCommonGameSummary(
        uint256 tokenId,
        string memory newName,
        string memory newImageURI,
        string memory newExternalURI,
        uint256 newTotalAchievements
    ) public onlyRole(GAME_CREATOR_ROLE) whenNotPaused {
        require(tokenId > 0, "TokenId must be greater than 0");
        require(commonGameSummaries[tokenId].storeId != 0, "Token doesn't exists");
        GameSummary storage gameData = commonGameSummaries[tokenId];
        gameData.name = newName;
        gameData.image = newImageURI;
        gameData.externalURI = newExternalURI;
        gameData.totalAchievements = newTotalAchievements;
        emit GameSummaryUpdated(msg.sender, tokenId);
    }

    function addPlayerAchievements(address player, uint256 tokenId, uint256 newAchievements) private {
        require(tokenId > 0, "TokenId must be greater than 0");
        require(playerGameData[player][tokenId].tokenId != 0, "Token doesn't exists");
        PlayerGameData storage playerData = playerGameData[player][tokenId];
        if (playerData.achievementsMinted + newAchievements > commonGameSummaries[tokenId].totalAchievements) {
            revert("total achievements exceeded");
        }
        playerData.achievementsMinted += newAchievements;
        emit PlayerGameSummaryUpdated(player, tokenId, playerData.achievementsMinted);
    }

    function adminUpdatePlayerAchievements(
        address player,
        uint256 tokenId,
        uint256 newAchievements
    ) public onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        addPlayerAchievements(player, tokenId, newAchievements);
    }

    function updatePlayerAchievementsWithSignature(
        uint256 tokenId,
        uint256 newAchievements,
        uint256 nonce,
        bytes memory signature
    ) public nonReentrant onlyOnceSignature(signature) whenNotPaused {
        require(verifySignature(nonce, signature), "Invalid signature");
        addPlayerAchievements(msg.sender, tokenId, newAchievements);
    }

    function createCommonGameSummary(
        uint256 storeId,
        uint256 gameId,
        string memory name,
        string memory onChainURI,
        string memory externalURI,
        uint256 totalAchievements
    ) public onlyRole(GAME_CREATOR_ROLE) {
        require(gameId > 0, "GameId must be greater than 0");
        require(storeId > 0, "StoreId must be greater than 0");
        uint256 tokenId = getTokenId(storeId, gameId);
        require(commonGameSummaries[tokenId].tokenId != tokenId, "CommonGameSummary already exists");
        commonGameSummaries[tokenId] = GameSummary(
            tokenId,
            storeId,
            gameId,
            name,
            onChainURI,
            externalURI,
            totalAchievements
        );
        emit GameSummaryMinted(msg.sender, tokenId, totalAchievements);
    }

    function mintGameSummary(
        address player,
        uint256 gameId,
        uint256 achievementsLength,
        uint256 storeId,
        bool soulbound
    ) private {
        require(storeId > 0, "StoreId must be greater than 0");
        require(gameId > 0, "GameId must be greater than 0");
        uint256 tokenId = getTokenId(storeId, gameId);
        require(commonGameSummaries[tokenId].tokenId == tokenId, "This game is not allowed yet");
        require(playerGameData[player][tokenId].tokenId == 0, "Token already exists");
        _mint(player, tokenId, 1, "");
        playerGameData[player][tokenId] = PlayerGameData(tokenId, achievementsLength, soulbound);
        emit PlayerGameSummaryMinted(player, tokenId, achievementsLength);
    }

    function adminMintGameSummary(
        address to,
        uint256 gameId,
        uint256 achievementsLength,
        uint256 storeId,
        bool soulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        mintGameSummary(to, gameId, achievementsLength, storeId, soulbound);
    }

    function mintGameSummaryWithSignature(
        uint256 gameId,
        uint256 achievementsLength,
        uint256 storeId,
        uint256 nonce,
        bytes memory signature
    ) public nonReentrant onlyOnceSignature(signature) whenNotPaused {
        require(verifySignature(nonce, signature), "Invalid signature");
        mintGameSummary(msg.sender, gameId, achievementsLength, storeId, true);
    }

    function adminBatchPlayerUpdateAchievements(
        address[] memory players,
        uint256[] calldata tokenIds,
        uint256[] calldata newAchievements
    ) public onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        require(players.length == tokenIds.length, "The players and tokenIds arrays must have the same length");
        require(
            players.length == newAchievements.length,
            "The players and newAchievements arrays must have the same length"
        );
        for (uint i = 0; i < players.length; i++) {
            addPlayerAchievements(players[i], tokenIds[i], newAchievements[i]);
        }
    }

    function batchPlayerUpdateAchievementsWithSignature(
        uint256[] calldata tokenIds,
        uint256[] calldata newAchievements,
        uint256 nonce,
        bytes memory signature
    ) public nonReentrant onlyOnceSignature(signature) whenNotPaused {
        require(verifySignature(nonce, signature), "Invalid signature");
        require(
            tokenIds.length == newAchievements.length,
            "The players and newAchievements arrays must have the same length"
        );
        for (uint i = 0; i < tokenIds.length; i++) {
            addPlayerAchievements(msg.sender, tokenIds[i], newAchievements[i]);
        }
    }

    function adminBatchMintGameSummary(
        address[] calldata players,
        uint256[] calldata gameIds,
        uint256[] calldata achievementsLength,
        uint256[] calldata storeIds,
        bool[] calldata soulbounds
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(players.length == gameIds.length, "The players and gameIds arrays must have the same length");
        require(players.length == storeIds.length, "The players and storeIds arrays must have the same length");
        require(
            players.length == achievementsLength.length,
            "The players and newAchievements arrays must have the same length"
        );
        for (uint i = 0; i < players.length; i++) {
            mintGameSummary(players[i], gameIds[i], achievementsLength[i], storeIds[i], soulbounds[i]);
        }
    }

    function batchMintGameSummaryWithSignature(
        uint256[] calldata gameIds,
        uint256[] calldata newAchievements,
        uint256[] calldata storeIds,
        uint256 nonce,
        bytes memory signature
    ) public whenNotPaused onlyOnceSignature(signature) nonReentrant {
        require(verifySignature(nonce, signature), "Invalid signature");
        require(gameIds.length == storeIds.length, "The gameIds and storeIds arrays must have the same length");
        require(
            gameIds.length == newAchievements.length,
            "The gameIds and newAchievements arrays must have the same length"
        );

        for (uint i = 0; i < gameIds.length; i++) {
            mintGameSummary(msg.sender, gameIds[i], newAchievements[i], storeIds[i], true);
        }
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public virtual override {
        require(playerGameData[_from][_id].tokenId != 0, "Token doesn't exists");
        require(!playerGameData[_from][_id].soulbounded, "You can't transfer this token");
        PlayerGameData storage playerData = playerGameData[_from][_id];
        uint256 transferachievements = playerData.achievementsMinted;
        playerGameData[_from][_id] = PlayerGameData(0, 0, false);
        if (playerGameData[_to][_id].tokenId != 0) {
            revert("Token already exists, not possible to send it");
        }
        playerGameData[_to][_id] = PlayerGameData(_id, transferachievements, false);
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual override {
        for (uint i = 0; i < _ids.length; i++) {
            require(playerGameData[_from][_ids[i]].tokenId != 0, "Token doesn't exists");
            require(!playerGameData[_from][_ids[i]].soulbounded, "You can't transfer this token");
        }
        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);

        for (uint i = 0; i < _ids.length; i++) {
            PlayerGameData storage playerData = playerGameData[_from][_ids[i]];
            uint256 transferachievements = playerData.achievementsMinted;
            playerGameData[_from][_ids[i]] = PlayerGameData(0, 0, false);
            playerGameData[_to][_ids[i]] = PlayerGameData(_ids[i], transferachievements, false);
        }
    }

    function uri(uint256 _tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(baseUri, Strings.toString(_tokenId), ".json"));
    }

    function burn(uint256 tokenId) public nonReentrant {
        require(playerGameData[msg.sender][tokenId].tokenId != 0, "Token doesn't exists");
        _burn(msg.sender, tokenId, 1);
        playerGameData[msg.sender][tokenId] = PlayerGameData(0, 0, false);
    }

    function burnBatch(uint256[] memory tokenIds) public nonReentrant {
        uint256[] memory amounts = new uint256[](tokenIds.length);
        for (uint i = 0; i < tokenIds.length; i++) {
            require(playerGameData[msg.sender][tokenIds[i]].tokenId != 0, "Token doesn't exist");
            require(balanceOf(msg.sender, tokenIds[i]) > 0, "You don't have a token to burn");
            amounts[i] = 1;
            playerGameData[msg.sender][tokenIds[i]] = PlayerGameData(0, 0, false);
        }
        _burnBatch(msg.sender, tokenIds, amounts);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
