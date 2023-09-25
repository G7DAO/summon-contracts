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
  bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

  event GameSummaryUpdated(address indexed indexer, uint256 indexed gameId);
  event GameSummaryMinted(address indexed player, uint256 indexed gameId, uint256 achievementCount);
  event AchievementMinted(address indexed player, uint256 indexed gameAchievementId);
  event SignerAdded(address signer);
  event SignerRemoved(address signer);
  event AchievementMintPaused(bool paused);
  event TokenBurned(address indexed player, uint256 indexed tokenId, uint256 amount, address indexed recoveryAddress);

  string private baseUri;
  bool public achievementMintPaused = false;
  bool public gameSummaryMintPaused = false;

  struct Achievement {
    uint256 achievementId;
    string uri;
    string description;
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

  // player address => whitelisted recovery address
  mapping(address => bool) public recoveryList;

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

  //TODO: this function could be create an off-sync ids between the original achievement length minted and the game summary length, because if this decrease the achievements, the previous achievements minted must be burned
  function updateGameSummary(address player, uint256 gameId, uint256 newAchievementsLength) public onlyRole(DEFAULT_ADMIN_ROLE) {
    require(playerGameSummaries[player][gameId].length > 0, "GameAchievements: You don't have any game summary");
    GameSummary storage gameSummary = playerGameSummaries[player][gameId][0];
    gameSummary.achievements = newAchievementsLength;
    emit GameSummaryUpdated(player, gameId);
  }

  function mintGameSummary(
    address player,
    uint256 gameId,
    string memory gameName,
    string memory gameURI,
    uint256[] calldata achievements,
    uint256 storeId
  ) private {
    for (uint i = 0; i < achievements.length; i++) {
      uint256 tokenId = concat(gameId, achievements[i]);
      uint256 achievementId = achievements[i];
      // check in the playerAchievements mapping if the achievement has been minted for this player
      // if not, mint it, otherwise skip it
      if (playerAchievements[player][tokenId].achievementId != achievementId) {
        Achievement memory newAchievement = Achievement({ achievementId: achievementId, uri: "", description: "" });
        playerAchievements[player][tokenId] = newAchievement;
        _mint(player, tokenId, 1, "");
        emit AchievementMinted(player, tokenId);
      } else {
        continue;
      }
    }
    playerGameSummaries[player][gameId].push(GameSummary({ gameId: gameId, name: gameName, image: gameURI, achievements: achievements.length, storeId: storeId }));
    emit GameSummaryMinted(player, gameId, achievements.length);
  }

  function adminMintGameSummary(
    address to,
    uint256 gameId,
    string memory gameName,
    string memory gameURI,
    uint256[] calldata achievements,
    uint256 storeId
  ) public onlyRole(MINTER_ROLE) notAchievementMintPaused {
    mintGameSummary(to, gameId, gameName, gameURI, achievements, storeId);
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
    mintGameSummary(msg.sender, gameId, gameName, gameURI, achievements, storeId);
  }

  function adminMint(
    address player,
    uint256 gameId,
    uint256 amount,
    uint256 achievementId,
    string memory achievementURI,
    string memory achievementDescription
  ) public onlyRole(MINTER_ROLE) notAchievementMintPaused {
    mintAchievement(player, gameId, amount, achievementId, achievementURI, achievementDescription);
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
    string memory achievementDescription
  ) private {
    // Create a simple token ID based on hashing game and achievement details
    uint256 tokenId = concat(gameId, achievementId);
    Achievement memory newAchievement = Achievement({ achievementId: achievementId, uri: achievementURI, description: achievementDescription });

    // check in the playerAchievements mapping if the achievement has been minted
    // if not, mint it, otherwise skip
    require(playerAchievements[player][tokenId].achievementId != achievementId, "GameAchievements: Achievement already minted");
    playerAchievements[player][tokenId] = newAchievement;
    _mint(player, tokenId, amount, "");
    emit AchievementMinted(player, tokenId);
  }

  function mintAchievementWithSignature(
    address player,
    uint256 gameId,
    uint256 amount,
    uint256 achievementId,
    string memory achievementURI,
    string memory achievementDescription,
    uint256 nonce,
    bytes memory signature
  ) public notAchievementMintPaused nonReentrant {
    require(verifySignature(nonce, signature), "GameAchievements: Invalid signature");
    mintAchievement(player, gameId, amount, achievementId, achievementURI, achievementDescription);
  }

  function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) public virtual override {
    if (playerAchievements[_from][_id].achievementId != 0) {
      require(playerAchievements[_from][_id].achievementId != _id, "GameAchievements: You can't transfer this token");
    }

    super.safeTransferFrom(_from, _to, _id, _amount, _data);
  }

  function safeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) public virtual override {
    for (uint i = 0; i < _ids.length; i++) {
      if (playerAchievements[_from][_ids[i]].achievementId != 0) {
        require(playerAchievements[_from][_ids[i]].achievementId != _ids[i], "GameAchievements: You can't transfer this token");
      }
    }
    super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
  }

  function uri(uint256 _tokenId) public view override returns (string memory) {
    return string(abi.encodePacked(baseUri, "/", Strings.toString(_tokenId), ".json"));
  }

  function setSigner(address _signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
    whitelistSigners[_signer] = true;
    emit SignerAdded(_signer);
  }

  function removeSigner(address signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
    whitelistSigners[signer] = false;
    emit SignerRemoved(signer);
  }

  function addToRecoveryList(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
    recoveryList[account] = true;
  }

  function removeFromRecoveryList(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
    recoveryList[account] = false;
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

  function burn(address account, uint256 id, uint256 amount, uint256 nonce, bytes memory signature) public onlyRole(BURNER_ROLE) {
    address signer = recoverAddress(nonce, signature);
    require(signer == account, "GameAchievements: The account can't burn tokens because is in the recovery list");
    require(recoveryList[signer], "GameAchievements: The signer is not in the recovery list");
    _safeTransferFrom(account, signer, id, amount, "");
    emit TokenBurned(account, id, amount, signer);
  }

  function burnBatch(address account, uint256[] memory ids, uint256[] memory amounts, uint256 nonce, bytes memory signature) public onlyRole(BURNER_ROLE) {
    address signer = recoverAddress(nonce, signature);
    require(signer == account, "GameAchievements: The account can't burn tokens because is in the recovery list");
    require(recoveryList[signer], "GameAchievements: The signer is not in the recovery list");
    for (uint i = 0; i < ids.length; i++) {
      _safeTransferFrom(account, signer, ids[i], amounts[i], "");
      emit TokenBurned(account, ids[i], amounts[i], signer);
    }
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
