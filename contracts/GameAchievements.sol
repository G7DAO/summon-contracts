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

contract GameAchievements is ERC1155, AccessControl, ReentrancyGuard {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

  event GameSummaryUpdated(address indexed indexer, uint256 indexed gameId);
  event GameSummaryMinted(address indexed player, uint256 indexed gameId, uint256[] achievements);
  event AchievementMinted(address indexed player, uint256 indexed gameAchievementId);
  event SignerAdded(address signer);
  event SignerRemoved(address signer);
  event AchievementMintPaused(bool paused);

  string public baseUri;
  bool public achievementMintPaused = false;

  struct Achievement {
    uint256 achievementId;
    string uri;
    string description;
    uint256 tokenId;
    bool soulBounded;
  }

  struct GameSummary {
    uint256 storeId;
    uint256 gameId;
    string name;
    string image;
    uint256 achievements;
  }

  // player address => gameId => game summary
  mapping(address => mapping(uint256 => GameSummary[])) public playerGameSummaries;

  // player address => concat (game id + achievement id)  => achievement
  mapping(address => mapping(uint256 => Achievement)) public playerAchievements;

  mapping(address => bool) public whitelistSigners;

  modifier notAchievementMintPaused() {
    require(achievementMintPaused == false, "GameAchievements: Sorry, this function is paused");
    _;
  }

  constructor(string memory _uri) ERC1155(_uri) {
    baseUri = _uri;
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  function setBaseUri(string memory _uri) public onlyRole(DEFAULT_ADMIN_ROLE) {
    baseUri = _uri;
  }

  function pauseAchievementMint() public onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!achievementMintPaused, "GameAchievements: Minting is already paused");
    achievementMintPaused = true;
    emit AchievementMintPaused(achievementMintPaused);
  }

  function unpauseAchievementMint() public onlyRole(DEFAULT_ADMIN_ROLE) {
    require(achievementMintPaused, "GameAchievements: Minting is not paused");
    achievementMintPaused = false;
    emit AchievementMintPaused(achievementMintPaused);
  }

  function getGameSummary(uint256 gameId) public view returns (GameSummary memory) {
    return playerGameSummaries[msg.sender][gameId][0];
  }

  function getGameSummaries(uint256[] memory gameIds) public view returns (GameSummary[] memory) {
    GameSummary[] memory summaries = new GameSummary[](gameIds.length);
    for (uint i = 0; i < gameIds.length; i++) {
      summaries[i] = playerGameSummaries[msg.sender][gameIds[i]][0];
    }
    return summaries;
  }

  function updateGameSummary(
    address player,
    uint256 gameId,
    uint256[] calldata newAchievements,
    bool soulbound
  ) public onlyRole(DEFAULT_ADMIN_ROLE) notAchievementMintPaused {
    require(playerGameSummaries[player][gameId].length > 0, "GameAchievements: The player don't have any game summary");
    require(newAchievements.length > 0, "GameAchievements: The new achievements array is empty");
    GameSummary storage gameSummary = playerGameSummaries[player][gameId][0];
    gameSummary.achievements += newAchievements.length;
    for (uint i = 0; i < newAchievements.length; i++) {
      uint256 tokenId = concat(gameId, newAchievements[i]);
      uint256 achievementId = newAchievements[i];
      // check in the playerAchievements mapping if the achievement has been minted for this player
      // if not, mint it, otherwise skip it
      if (playerAchievements[player][tokenId].achievementId != achievementId) {
        Achievement memory newAchievement = Achievement({ achievementId: achievementId, uri: "", description: "", tokenId: tokenId, soulBounded: soulbound });
        playerAchievements[player][tokenId] = newAchievement;
        _mint(player, tokenId, 1, "");
        emit AchievementMinted(player, tokenId);
      } else {
        continue;
      }
    }
    emit GameSummaryUpdated(player, gameId);
  }

  function updateAchievementSoulBound(address player, uint256 tokenId, bool soulBound) public onlyRole(DEFAULT_ADMIN_ROLE) notAchievementMintPaused {
    require(playerAchievements[player][tokenId].soulBounded != soulBound, "GameAchievements: The achievement already has this soulbound value");
    require(playerAchievements[player][tokenId].tokenId != 0, "GameAchievements: The achievement doesn't exists");
    playerAchievements[player][tokenId].soulBounded = soulBound;
  }

  function mintGameSummary(
    address player,
    uint256 gameId,
    string memory gameName,
    string memory gameURI,
    uint256[] calldata achievements,
    uint256 storeId,
    bool soulBounded
  ) private {
    for (uint i = 0; i < achievements.length; i++) {
      uint256 tokenId = concat(gameId, achievements[i]);
      uint256 achievementId = achievements[i];
      // check in the playerAchievements mapping if the achievement has been minted for this player
      // if not, mint it, otherwise skip it
      if (playerAchievements[player][tokenId].achievementId != achievementId) {
        Achievement memory newAchievement = Achievement({ achievementId: achievementId, uri: "", description: "", tokenId: tokenId, soulBounded: soulBounded });
        playerAchievements[player][tokenId] = newAchievement;
        _mint(player, tokenId, 1, "");
      } else {
        continue;
      }
    }
    playerGameSummaries[player][gameId].push(
      GameSummary({ gameId: gameId, name: gameName, image: gameURI, achievements: achievements.length, storeId: storeId })
    );
    emit GameSummaryMinted(player, gameId, achievements);
  }

  function adminBatchMintGameSummary(
    address[] calldata players,
    uint256[] calldata gameIds,
    string[] memory gameNames,
    string[] memory gameURIs,
    uint256[][] calldata newAchievements,
    uint256[] calldata storeIds,
    bool[] calldata soulBounds
  ) public onlyRole(MINTER_ROLE) notAchievementMintPaused {
    require(players.length == gameIds.length, "GameAchievements: The players and gameIds arrays must have the same length");
    require(players.length == storeIds.length, "GameAchievements: The players and storeIds arrays must have the same length");
    require(players.length == gameURIs.length, "GameAchievements: The players and gameURIs arrays must have the same length");
    require(players.length == gameNames.length, "GameAchievements: The players and gameNames arrays must have the same length");
    require(players.length == newAchievements.length, "GameAchievements: The players and newAchievements arrays must have the same length");
    require(players.length == soulBounds.length, "GameAchievements: The players and soulBounds arrays must have the same length");
    for (uint i = 0; i < players.length; i++) {
      mintGameSummary(players[i], gameIds[i], gameNames[i], gameURIs[i], newAchievements[i], storeIds[i], soulBounds[i]);
    }
  }

  function adminBatchMintGameSummaryWithSignature(
    address[] calldata players,
    uint256[] calldata gameIds,
    string[] memory gameNames,
    string[] memory gameURIs,
    uint256[][] calldata newAchievements,
    uint256[] calldata storeIds,
    uint256 nonce,
    bytes memory signature
  ) public notAchievementMintPaused nonReentrant {
    require(verifySignature(nonce, signature), "GameAchievements: Invalid signature");
    require(players.length == gameIds.length, "GameAchievements: The players and gameIds arrays must have the same length");
    require(players.length == storeIds.length, "GameAchievements: The players and storeIds arrays must have the same length");
    require(players.length == gameURIs.length, "GameAchievements: The players and gameURIs arrays must have the same length");
    require(players.length == gameNames.length, "GameAchievements: The players and gameNames arrays must have the same length");
    require(players.length == newAchievements.length, "GameAchievements: The players and newAchievements arrays must have the same length");

    for (uint i = 0; i < players.length; i++) {
      mintGameSummary(players[i], gameIds[i], gameNames[i], gameURIs[i], newAchievements[i], storeIds[i], true);
    }
  }

  function adminMintGameSummary(
    address to,
    uint256 gameId,
    string memory gameName,
    string memory gameURI,
    uint256[] calldata achievements,
    uint256 storeId,
    bool soulBounded
  ) public onlyRole(MINTER_ROLE) notAchievementMintPaused {
    mintGameSummary(to, gameId, gameName, gameURI, achievements, storeId, soulBounded);
  }

  function mintGameSummaryWithSignature(
    uint256 gameId,
    string memory gameName,
    string memory gameURI,
    uint256[] calldata achievements,
    uint256 storeId,
    uint256 nonce,
    bytes memory signature
  ) public nonReentrant notAchievementMintPaused {
    require(verifySignature(nonce, signature), "GameAchievements: Invalid signature");
    mintGameSummary(msg.sender, gameId, gameName, gameURI, achievements, storeId, true);
  }

  function adminMint(
    address player,
    uint256 gameId,
    uint256 amount,
    uint256 achievementId,
    string memory achievementURI,
    string memory achievementDescription,
    bool soulBound
  ) public onlyRole(MINTER_ROLE) notAchievementMintPaused {
    mintAchievement(player, gameId, amount, achievementId, achievementURI, achievementDescription, soulBound);
  }

  function concat(uint256 a, uint256 b) private pure returns (uint256) {
    uint256 temp = b;
    while (temp != 0) {
      a *= 10;
      temp /= 10;
    }
    return a + b;
  }

  function mintAchievement(
    address player,
    uint256 gameId,
    uint256 amount,
    uint256 achievementId,
    string memory achievementURI,
    string memory achievementDescription,
    bool soulBound
  ) private {
    // Create a simple token ID based on hashing game and achievement details
    uint256 tokenId = concat(gameId, achievementId);
    // check in the playerAchievements mapping if the achievement has been minted
    require(playerAchievements[player][tokenId].achievementId != achievementId, "GameAchievements: Achievement already minted");
    Achievement memory newAchievement = Achievement({
      achievementId: achievementId,
      uri: achievementURI,
      description: achievementDescription,
      tokenId: tokenId,
      soulBounded: soulBound
    });

    // if not, mint it, otherwise skip
    playerAchievements[player][tokenId] = newAchievement;
    _mint(player, tokenId, amount, "");
    emit AchievementMinted(player, tokenId);
  }

  function mintAchievementWithSignature(
    uint256 gameId,
    uint256 amount,
    uint256 achievementId,
    string memory achievementURI,
    string memory achievementDescription,
    uint256 nonce,
    bytes memory signature
  ) public notAchievementMintPaused nonReentrant {
    require(verifySignature(nonce, signature), "GameAchievements: Invalid signature");
    mintAchievement(msg.sender, gameId, amount, achievementId, achievementURI, achievementDescription, true);
  }

  function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) public virtual override {
    require(playerAchievements[_from][_id].tokenId != 0, "GameAchievements: Token doesn't exists");
    require(!playerAchievements[_from][_id].soulBounded, "GameAchievements: You can't transfer this token");
    super.safeTransferFrom(_from, _to, _id, _amount, _data);
  }

  function safeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) public virtual override {
    for (uint i = 0; i < _ids.length; i++) {
      require(playerAchievements[_from][_ids[i]].tokenId != 0, "GameAchievements: Token doesn't exists");

      require(!playerAchievements[_from][_ids[i]].soulBounded, "GameAchievements: You can't transfer this token");
    }
    super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
  }

  function uri(uint256 _tokenId) public view override returns (string memory) {
    return string(abi.encodePacked(baseUri, Strings.toString(_tokenId), ".json"));
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

  function burn(address account, uint256 id, uint256 amount) public nonReentrant {
    require(account == msg.sender, "GameAchievements: You can only burn your own tokens");
    require(playerAchievements[msg.sender][id].tokenId != 0, "GameAchievements: Token doesn't exists");
    require(!playerAchievements[msg.sender][id].soulBounded, "GameAchievements: You can't burn this token");

    _burn(account, id, amount);
  }

  function burnBatch(address account, uint256[] memory ids, uint256[] memory amounts) public nonReentrant {
    for (uint i = 0; i < ids.length; i++) {
      require(account == msg.sender, "GameAchievements: You can only burn your own tokens");
      require(playerAchievements[msg.sender][ids[i]].tokenId != 0, "GameAchievements: Token doesn't exists");
      require(!playerAchievements[msg.sender][ids[i]].soulBounded, "GameAchievements: You can't burn this token");
    }

    _burnBatch(account, ids, amounts);
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
