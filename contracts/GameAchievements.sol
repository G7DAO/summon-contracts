// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * Authors: Omar Garcia <omar@game7.io>
 * GitHub: https://github.com/ogarciarevett
 */

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";


contract AchievoGames is ERC1155, AccessControl {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant HYPERPLAY_ROLE = keccak256("HYPERPLAY_ROLE");
  string public STORE_NAME = "STEAM";

  event GameSaved(address indexed indexer, uint256 indexed gameId);
  event GameUpdated(address indexed indexer, uint256 indexed gameId);
  event AchievementMinted(address indexed creator, uint256 indexed tokenId, address indexed userAddress);
  event AchievementSaved(address indexed indexer, uint256 indexed gameId, uint256 achievementId);
  event AchievementUpdated(address indexed indexer, uint256 indexed gameId, uint256 achievementId);
  event SignerAdded(address signer);
  event SignerRemoved(address signer);
  event AchievementMintPaused(bool paused);

  string private baseUri;
  bool public achievementMintPaused = false;

  struct Game {
    uint256 gameId;
    string name;
    string image;
  }

  // Player => AchievementId => AchievementSoulBounded
  mapping(address => mapping(uint256 => bool)) public achievementSoulBounded;

  mapping(address => bool) public whitelistSigners;

  mapping(uint256 => Game) public games;

  modifier noPaused() {
    require(achievementMintPaused == false, "AchievoGames: Sorry, this function is paused");
    _;
  }

  constructor(string memory _uri) ERC1155(_uri) {
    baseUri = _uri;
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  function upsertGame(uint256 _gameId, string memory _name, string memory _image) public onlyRole(DEFAULT_ADMIN_ROLE) {
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
    require(!achievementMintPaused, "AchievoGames: Minting is already paused");
    achievementMintPaused = true;
    emit AchievementMintPaused(achievementMintPaused);
  }

  function unpauseAchievementMint() public onlyRole(DEFAULT_ADMIN_ROLE) {
    require(achievementMintPaused, "AchievoGames: Minting is not paused");
    achievementMintPaused = false;
    emit AchievementMintPaused(achievementMintPaused);
  }

  function mintAchievements(
    address _to,
    uint256 _gameId,
    string memory _gameImageURI,
    string memory _gameName,
    uint256[] calldata achievements
  ) public onlyRole(MINTER_ROLE) noPaused {
    // This will save the game as token id
    _mint(_to, _gameId, 1, "");
    games[_gameId].image = _gameImageURI;
    games[_gameId].name = _gameName;
    for (uint256 i = 0; i < achievements.length; i++) {
      uint256 achievementId = achievements[i];
      achievementSoulBounded[_to][achievementId] = true;
      emit AchievementMinted(msg.sender, achievementId, _to);
    }
  }

  // TODO: create a batchMint function

  function mintWithSignature(
    address _to,
    uint256 _gameId,
    string memory _gameImageURI,
    string memory _gameName,
    uint256[] calldata achievements,
    uint256 nonce,
    bytes memory signature
  ) public noPaused {
    require(verifySignature(nonce, signature), "AchievoGames: Invalid signature");
    mintAchievements(_to, _gameId, _gameImageURI, _gameName, achievements);
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

  function uri(uint256 _achievementIdAndGameId) public view override returns (string memory) {
    return string(abi.encodePacked(baseUri, "/",Strings.toString(_achievementIdAndGameId), ".json"));
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
