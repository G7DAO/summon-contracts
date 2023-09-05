// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * Authors: Omar Garcia <omar@game7.io>
 * GitHub: https://github.com/ogarciarevett
 */

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AchievementFacet is ERC1155, AccessControl {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant HYPERPLAY_ROLE = kekkack256("HYPERPLAY_ROLE");

  string private baseUri;
  string public _contractURI = "FILL_ME";

  struct Game {
    uint256 gameId
    string name
    string description
    string image
    string url
    mapping(uint256 => uint8) stores
    mapping(uint256 => uint256) achievements
  }

  mapping(address => bool) public whitelistSigners;

  event GameSaved(address indexed indexer, uint256 indexed gameId, uint256 indexed storeId);
  event GameUpdated(address indexed indexer, uint256 indexed gameId, uint256 indexed storeId);
  event GameDeleted(address indexed indexer, uint256 indexed gameId, uint256 indexed storeId);
  event AchievementMinted(address indexed creator, uint256 indexed tokenId, bool soulbounded, address indexed userAddress);
  event AchievementSaved(address indexed indexer, uint256 indexed gameId, uint256 indexed storeId, uint256 achievementId);
  event AchievementUpdated(address indexed indexer, uint256 indexed gameId, uint256 indexed storeId, uint256 achievementId);
  event SignerAdded(address signer);
  event SignerRemoved(address signer);

  function contractURI() public view returns (string memory) {
    return _contractURI;
  }

  function setContractURI(string memory __contractURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
    _contractURI = __contractURI;
  }

  constructor(string memory _uri) ERC1155(_uri) {
    baseUri = _uri;
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  function pause() external onlyRole(HYPERPLAY_ROLE) {
    _pause();
  }

  function unpause() external onlyRole(HYPERPLAY_ROLE) {
    _unpause();
  }

  function mint(address _to, uint256 _id, uint256 _amount, bool _soulbound) external onlyRole(MINTER_ROLE) whenNotPaused {
    _mint(_to, _id, _amount, "");
  }

  function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) public virtual override whenNotPaused {
    // if (astore.tokenData[_id].soulbounded) {
    //   require(astore.tokenData[_id].owner == _from, "AchievementFacet: Cannot transfer soulbound token");
    // }
    // super.safeTransferFrom(_from, _to, _id, _amount, _data);
  }

  function safeBatchTransferFrom(
    address _from,
    address _to,
    uint256[] memory _ids,
    uint256[] memory _amounts,
    bytes memory _data
  ) public virtual override whenNotPaused {
    // for (uint256 i = 0; i < _ids.length; ++i) {
    //   if (tokenData[_ids[i]].soulbounded) {
    //     require(astore.tokenData[_ids[i]].owner == _from, "AchievementFacet: Cannot transfer soulbounded token");
    //   }
    // }
    // super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function uri(uint256 tokenId) public view override returns (string memory) {
    return string(abi.encodePacked(baseUri, Strings.toString(tokenId)));
  }

  function setSigner(address _signer) public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
    whitelistSigners[_signer] = true;
    emit SignerAdded(_signer);
  }

  function removeSigner(address signer) public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
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
}
