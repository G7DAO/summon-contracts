// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * Authors: Omar Garcia <omar@game7.io>
 * GitHub: https://github.com/ogarciarevett
 */

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// This contract contains only the phase 1 of the GameSummaries contract
contract GameSummary1155 is ERC1155, AccessControl, ReentrancyGuard {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant GAME_CREATOR_ROLE = keccak256("GAME_CREATOR_ROLE");

  event GameSummaryCreated(address indexed creator, uint256 indexed tokenId);
  event GameSummaryUpdated(address indexed indexer, uint256 indexed tokenId);
  event GameSummaryMinted(address indexed player, uint256 indexed gameId, uint256 achievements);
  event SignerAdded(address signer);
  event SignerRemoved(address signer);
  event GameSummaryMintedPaused(bool paused);

  string public baseUri;
  bool public gameSummaryMintPaused = false;

  struct GameSummary {
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
    bool soulBounded;
  }

  // tokenId(storeId+0+gameId) => common game data
  mapping(uint256 => GameSummary) public commonGameSummaries;

  // player address => tokenId(storeId+0+gameId) => player game data
  mapping(address => mapping(uint256 => PlayerGameData)) public playerGameData;

  mapping(address => bool) public whitelistSigners;

  modifier notGameSummaryMintPaused() {
    require(gameSummaryMintPaused == false, "Minting is paused");
    _;
  }

  constructor(string memory _uri) ERC1155(_uri) {
    baseUri = _uri;
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  function concat(uint256 storeId, uint256 gameId) private pure returns (uint256) {
    string memory gameIdStr = Strings.toString(gameId);
    string memory storeIdStr = Strings.toString(storeId);
    string memory zero = "0";
    string memory concatenatedString = string(abi.encodePacked(storeIdStr, zero, gameIdStr));
    uint256 concatenatedUint = stringToUint(concatenatedString);
    return concatenatedUint;
  }

  function stringToUint(string memory s) private pure returns (uint256) {
    bytes memory b = bytes(s);
    uint256 result = 0;
    for (uint i = 0; i < b.length; i++) {
      uint256 c = uint256(uint8(b[i]));
      require(c >= 48 && c <= 57, "Not a digit");
      result = result * 10 + (c - 48);
    }
    return result;
  }

  function setBaseUri(string memory _uri) public onlyRole(DEFAULT_ADMIN_ROLE) {
    baseUri = _uri;
  }

  function pauseGameSummaryMint() public onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!gameSummaryMintPaused, "Minting is already paused");
    gameSummaryMintPaused = true;
    emit GameSummaryMintedPaused(gameSummaryMintPaused);
  }

  function unpauseGameSummaryMint() public onlyRole(DEFAULT_ADMIN_ROLE) {
    require(gameSummaryMintPaused, "Minting is not paused");
    gameSummaryMintPaused = false;
    emit GameSummaryMintedPaused(gameSummaryMintPaused);
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

  function verifySignature(uint256 nonce, bytes memory signature) public view returns (bool) {
    address signer = recoverAddress(nonce, signature);
    if (whitelistSigners[signer]) {
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

  function getPlayerGamesData(address player, uint256[] calldata tokenIds) public view returns (PlayerGameData[] memory) {
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
  ) public onlyRole(DEFAULT_ADMIN_ROLE) notGameSummaryMintPaused {
    require(tokenId > 0, "TokenId must be greater than 0");
    require(commonGameSummaries[tokenId].storeId != 0, "Token doesn't exists");
    GameSummary storage gameData = commonGameSummaries[tokenId];
    gameData.name = newName;
    gameData.image = newImageURI;
    gameData.externalURI = newExternalURI;
    gameData.totalAchievements = newTotalAchievements;
    emit GameSummaryUpdated(msg.sender, tokenId);
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
    uint256 tokenId = concat(storeId, gameId);
    require(commonGameSummaries[tokenId].storeId == 0, "Token already exists");
    commonGameSummaries[tokenId] = GameSummary(storeId, gameId, name, onChainURI, externalURI, totalAchievements);
    emit GameSummaryCreated(msg.sender, tokenId);
  }

  function mintGameSummary(
    address player,
    uint256 gameId,
    uint256 achievementsLength,
    uint256 storeId,
    bool soulBound
  ) private {
    require(storeId > 0, "StoreId must be greater than 0");
    uint256 tokenId = concat(storeId, gameId);
    require(playerGameData[player][tokenId].tokenId == 0, "Token already exists");
    _mint(player, tokenId, 1, "");
    playerGameData[player][tokenId] = PlayerGameData(tokenId, achievementsLength, soulBound);
    emit GameSummaryMinted(player, tokenId, achievementsLength);
  }

  function adminMintGameSummary(
    address to,
    uint256 gameId,
    uint256 achievementsLength,
    uint256 storeId,
    bool soulBound
  ) public onlyRole(MINTER_ROLE) notGameSummaryMintPaused {
    mintGameSummary(to, gameId, achievementsLength, storeId, soulBound);
  }

  function mintGameSummaryWithSignature(
    uint256 gameId,
    uint256 achievementsLength,
    uint256 storeId,
    uint256 nonce,
    bytes memory signature
  ) public nonReentrant notGameSummaryMintPaused {
    require(verifySignature(nonce, signature), "Invalid signature");
    mintGameSummary(msg.sender, gameId, achievementsLength, storeId, true);
  }

  function adminBatchMintGameSummary(
    address[] calldata players,
    uint256[] calldata gameIds,
    uint256[] calldata achievementsLength,
    uint256[] calldata storeIds,
    bool[] calldata soulBounds
  ) public onlyRole(MINTER_ROLE) notGameSummaryMintPaused {
    require(players.length == gameIds.length, "The players and gameIds arrays must have the same length");
    require(players.length == storeIds.length, "The players and storeIds arrays must have the same length");
    require(players.length == achievementsLength.length, "The players and newAchievements arrays must have the same length");
    for (uint i = 0; i < players.length; i++) {
      mintGameSummary(players[i], gameIds[i], achievementsLength[i], storeIds[i], soulBounds[i]);
    }
  }

  function batchMintGameSummaryWithSignature(
    uint256[] calldata gameIds,
    uint256[] calldata newAchievements,
    uint256[] calldata storeIds,
    uint256 nonce,
    bytes memory signature
  ) public notGameSummaryMintPaused nonReentrant {
    require(verifySignature(nonce, signature), "Invalid signature");
    require(gameIds.length == storeIds.length, "The players and storeIds arrays must have the same length");
    require(gameIds.length == newAchievements.length, "The players and newAchievements arrays must have the same length");

    for (uint i = 0; i < gameIds.length; i++) {
      mintGameSummary(msg.sender, gameIds[i], newAchievements[i], storeIds[i], true);
    }
  }

  function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) public virtual override {
    require(playerGameData[_from][_id].tokenId != 0, "Token doesn't exists");
    require(!playerGameData[_from][_id].soulBounded, "You can't transfer this token");
    super.safeTransferFrom(_from, _to, _id, _amount, _data);
  }

  function safeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) public virtual override {
    for (uint i = 0; i < _ids.length; i++) {
      require(playerGameData[_from][_ids[i]].tokenId != 0, "Token doesn't exists");

      require(!playerGameData[_from][_ids[i]].soulBounded, "You can't transfer this token");
    }
    super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
  }

  function uri(uint256 _tokenId) public view override returns (string memory) {
    return string(abi.encodePacked(baseUri, Strings.toString(_tokenId), ".json"));
  }

  function burn(uint256 tokenId, uint256 amount) public nonReentrant {
    require(playerGameData[msg.sender][tokenId].tokenId != 0, "Token doesn't exists");
    if(playerGameData[msg.sender][tokenId].soulBounded) {
      revert("You can't burn this token");
    }
    _burn(msg.sender, tokenId, amount);
  }

  function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) public nonReentrant {
    for (uint i = 0; i < tokenIds.length; i++) {
      require(playerGameData[msg.sender][tokenIds[i]].tokenId != 0, "Token doesn't exists");
      if(playerGameData[msg.sender][tokenIds[i]].soulBounded) {
        revert("You can't burn this token");
      }
    }
    _burnBatch(msg.sender, tokenIds, amounts);
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
