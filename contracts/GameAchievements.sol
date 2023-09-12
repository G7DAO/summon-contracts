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
  bytes32 public constant HYPERPLAY_ROLE = keccak256("HYPERPLAY_ROLE");

  event GameSaved(address indexed indexer, uint256 indexed gameId);
  event GameUpdated(address indexed indexer, uint256 indexed gameId);
  event GameSummaryMinted(address indexed player, uint256 indexed gameId, uint256 achievementCount);
  event AchievementMinted(address indexed player, uint256 indexed gameAchievementId);
  event SignerAdded(address signer);
  event SignerRemoved(address signer);
  event AchievementMintPaused(bool paused);

  string private baseUri;
  bool public achievementMintPaused = false;

  enum GameSource { Steam, EpicGames, GOG, HyperPlay, Other }

  struct Game {
    uint256 gameId;
    string name;
    string image;
  }

  struct Achievement {
    GameSource source;
    uint256 achievementId;
    string uri;
    string description;
  }

  mapping(address => mapping(uint256 => Achievement)) public playerAchievements;

  mapping(address => bool) public whitelistSigners;

  mapping(uint256 => Game) public games;

  modifier notPaused() {
    require(achievementMintPaused == false, "GameAchievements: Sorry, this function is paused");
    _;
  }

  constructor(string memory _uri) ERC1155(_uri) {
    baseUri = _uri;
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  function upsertGame(uint256 _gameId, string memory _name, string memory _image) public notPaused onlyRole(DEFAULT_ADMIN_ROLE) {
    // check if the game is already saved
    if(games[_gameId].gameId == 0) {
      games[_gameId] = Game(_gameId, _name, _image);
      emit GameSaved(msg.sender, _gameId);
      } else {
      games[_gameId].name = _name;
      games[_gameId].image = _image;
      emit GameUpdated(msg.sender, _gameId);
    }
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

  function mintGameSummary(
    address player,
    uint256 gameId,
    string memory gameName,
    string memory gameURI,
    uint256[] calldata achievements,
    GameSource source
  ) private {
    // This function will mint a summary of the game achievements by game id
    for (uint i = 0; i < achievements.length; i++) {
      uint256 tokenId = concat(gameId, achievements[i]);
      uint256 achievementId = achievements[i];
      Achievement memory newAchievement = Achievement({
        source: source,
        achievementId: achievementId,
        uri: "",
        description: ""
      });
      playerAchievements[player][tokenId] = newAchievement;
      _mint(player, tokenId, 1, "");
    }
    upsertGame(gameId, gameName, gameURI);
    emit GameSummaryMinted(player, gameId, achievements.length);
  }

  function adminMintGameSummary(
    address to,
    uint256 gameId,
    string memory gameName,
    string memory gameURI,
    uint256[] calldata achievements,
    GameSource source
  ) public onlyRole(MINTER_ROLE) notPaused {
    mintGameSummary(to, gameId, gameName, gameURI, achievements, source);
  }

  function mintGameSummaryWithSignature(
    uint256 gameId,
    string memory gameName,
    string memory gameURI,
    uint256[] calldata achievements,
    GameSource source,
    uint256 nonce,
    bytes memory signature
  ) public nonReentrant notPaused {
    require(verifySignature(nonce, signature), "GameAchievements: Invalid signature");
    mintGameSummary(msg.sender, gameId, gameName, gameURI, achievements, source);
  }

  function adminMint(
    address player,
    uint256 gameId,
    GameSource source,
    uint256 amount,
    uint256 achievementId,
    string memory achievementURI,
    string memory achievementDescription
  ) public onlyRole(MINTER_ROLE) notPaused {
    mintAchievement(player, gameId, source, amount, achievementId, achievementURI, achievementDescription);
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
    GameSource source,
    uint256 amount,
    uint256 achievementId,
    string memory achievementURI,
    string memory achievementDescription
  ) private {
    // Create a simple token ID based on hashing game and achievement details
    uint256 tokenId = concat(gameId, achievementId);
    upsertGame(gameId, "", "");
    Achievement memory newAchievement = Achievement({
      source: source,
      achievementId: achievementId,
      uri: achievementURI,
      description: achievementDescription
    });

    playerAchievements[player][tokenId] = newAchievement;
    _mint(player, tokenId, amount, "");
    emit AchievementMinted(player, tokenId);
  }

  function mintAchievementWithSignature(
    address player,
    uint256 gameId,
    GameSource source,
    uint256 amount,
    uint256 achievementId,
    string memory achievementURI,
    string memory achievementDescription,
    uint256 nonce,
    bytes memory signature
  ) public notPaused nonReentrant {
    require(verifySignature(nonce, signature), "GameAchievements: Invalid signature");
    mintAchievement(player, gameId, source, amount, achievementId, achievementURI, achievementDescription);
  }

  function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) public virtual override {
    return;
  }

  function safeBatchTransferFrom(
    address _from,
    address _to,
    uint256[] memory _ids,
    uint256[] memory _amounts,
    bytes memory _data
  ) public virtual override {
    return;
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

  function verifySignature(uint256 nonce, bytes memory signature) public view returns (bool) {
    bytes32 message = keccak256(abi.encodePacked(msg.sender, nonce));
    bytes32 hash = ECDSA.toEthSignedMessageHash(message);
    address signer = ECDSA.recover(hash, signature);
    if(whitelistSigners[signer]) {
      return true;
    } else {
      return false;
    }
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

}
