// SPDX-License-Identifier: UNLICENSED
///@notice This contract is for mock for WETH token.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./ERCSoulBound.sol";

error TokenNotExist();
error AlreadyMinted();
error ExceedMaxMint();

contract Game7SoulBound is ERC1155Burnable, ERCSoulBound, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    string private baseURI;
    string public name;
    string public symbol;
    using Strings for uint256;

    uint256 public MAX_PER_MINT = 1;

    mapping(uint256 => bool) public tokenExists;
    mapping(uint256 => mapping(address => bool)) public isMinted; // tokenId => address => bool

    modifier canMint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) {
        if (!tokenExists[tokenId]) {
            revert TokenNotExist();
        }

        if (isMinted[tokenId][to]) {
            revert AlreadyMinted();
        }

        if (amount > MAX_PER_MINT) {
            revert ExceedMaxMint();
        }
        _;
    }

    modifier canMintBatch(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!tokenExists[tokenIds[i]]) {
                revert TokenNotExist();
            }

            if (isMinted[tokenIds[i]][to]) {
                revert AlreadyMinted();
            }

            if (amounts[i] > MAX_PER_MINT) {
                revert ExceedMaxMint();
            }
        }

        
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initBaseURI,
        uint256 _maxPerMint,
        bool isPaused
    ) ERC1155(_initBaseURI) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);

        name = _name;
        symbol = _symbol;
        baseURI = _initBaseURI;
        MAX_PER_MINT = _maxPerMint;

        if (isPaused) _pause();
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function addNewToken(uint256 tokenId) external onlyRole(MANAGER_ROLE) {
        tokenExists[tokenId] = true;
    }

    // optional soulBound minting
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bool soulBound
    ) external onlyRole(MINTER_ROLE) canMint(to, id, amount) whenNotPaused {
        isMinted[id][to] = true;
        _mint(to, id, 1, "");
        if(soulBound) {
            _soulbound(to, id, 1);
        }
    }

    // optional soulBound batch minting
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bool soulBound
    ) external onlyRole(MINTER_ROLE) canMintBatch(to, ids, amounts) whenNotPaused {
        for (uint256 i = 0; i < ids.length; i++) {
            isMinted[ids[i]][to] = true;
        }

        _mintBatch(to, ids, amounts, "");
        if(soulBound) {
            _soulboundBatch(to, ids, amounts);
        }
    }

    function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) soulboundCheck(_from, _id, _amount) public virtual override {
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) soulboundCheckBatch(_from, _ids, _amounts) public virtual override {
        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
    }

    function burn(address to, uint256 tokenId, uint256 amount) public virtual override syncSoulbound(to, tokenId, amount) {
        _burn(to, tokenId, amount);
    }

    function burnBatch(address to, uint256[] memory tokenIds, uint256[] memory amounts) public virtual override syncBatchSoulbound(to, tokenIds, amounts) {
        _burnBatch(to, tokenIds, amounts);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        if (!tokenExists[tokenId]) {
            revert TokenNotExist();
        }
        return
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString()))
                : baseURI;
    }

    function updateBaseUri(string memory _baseURI) external onlyRole(MANAGER_ROLE) {
        baseURI = _baseURI;
    }
}
