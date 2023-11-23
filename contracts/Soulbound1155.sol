// SPDX-License-Identifier: UNLICENSED
///@notice This contract is for mock for WETH token.
pragma solidity ^0.8.17;

/**                        .;c;.
 *                      'lkXWWWXk:.
 *                    .dXMMMMMMMMWXkc'.
 *               .,..  ,dKNMMMMMMMMMMN0o,.
 *             ,dKNXOo'. .;dKNMMMMMMMMMWN0c.
 *            .kMMMMMWN0o;. .,lkNMMMMMMWKd,
 *            .OMMMMMMMMMN0x:. .'ckXN0o;. ..
 *             :ONMMMMMMMMMMWKxc. .... .:d0d.
 *              .'cxKWMMMMMMMMMWXkl,.  'o0Nk.
 *            .:l,  .:dKWMMMMMMMMMMNOl,. .;,
 *            .OMKl.   .;oOXWMMMMMMMMMN0o;.
 *            .co;.  .;,. .'lOXWMMMMMMMMMWKl.
 *               .:dOXWWKd;.  'ckXWMMMMMMMMk.
 *             .c0WMMMMMMMWKd:.  .:xXWMMMWNo.
 *             ,oONWMMMMMMMMWXOl.  .;okxl'
 *                .,lkXWMMMMMMMMWXO:
 *                    .ckKWMMMMMWKd;
 *                       .:d0X0d:.
 *                          ...
 */

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./ERCSoulbound.sol";

contract Soulbound1155 is ERC1155Burnable, ERCSoulbound, ERC2981, AccessControl, Pausable {
    event SignerAdded(address signer);
    event SignerRemoved(address signer);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    string private baseURI;
    string public name;
    string public symbol;
    using Strings for uint256;

    uint256 public MAX_PER_MINT = 1;

    mapping(uint256 => bool) public tokenExists;
    mapping(uint256 => mapping(address => bool)) public isMinted; // tokenId => address => bool

    mapping(address => bool) public whitelistSigners;
    mapping(bytes => bool) public usedSignatures;

    modifier signatureCheck(uint256 nonce, bytes memory signature) {
        if (!verifySignature(_msgSender(), nonce, signature)) {
            revert("Invalid signature");
        }
        _;
    }
    modifier canMint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) {
        if (!tokenExists[tokenId]) {
            revert("Token not exist");
        }

        if (isMinted[tokenId][to]) {
            revert("Already minted");
        }

        if (amount > MAX_PER_MINT) {
            revert("Exceed max mint");
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
                revert("Token not exist");
            }

            if (isMinted[tokenIds[i]][to]) {
                revert("Already minted");
            }

            if (amounts[i] > MAX_PER_MINT) {
                revert("Exceed max mint");
            }
        }

        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initBaseURI,
        uint256 _maxPerMint,
        bool _isPaused,
        address _devWallet,
        uint96 _royalty
    ) ERC1155(_initBaseURI) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        setSigner(msg.sender);

        _setDefaultRoyalty(_devWallet, _royalty);
        name = _name;
        symbol = _symbol;
        baseURI = _initBaseURI;
        MAX_PER_MINT = _maxPerMint;

        if (_isPaused) _pause();
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

    function __mint(address to, uint256 id, uint256 amount, bool soulbound) private {
        isMinted[id][to] = true;
        _mint(to, id, amount, "");
        if (soulbound) {
            _soulbound(to, id, amount);
        }
    }

    function __mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bool soulbound) private {
        for (uint256 i = 0; i < ids.length; i++) {
            isMinted[ids[i]][to] = true;
        }

        _mintBatch(to, ids, amounts, "");
        if (soulbound) {
            _soulboundBatch(to, ids, amounts);
        }
    }

    // optional soulbound minting
    function mint(
        uint256 id,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes memory signature
    ) external signatureCheck(nonce, signature) canMint(_msgSender(), id, amount) whenNotPaused {
        __mint(_msgSender(), id, amount, soulbound);
    }

    // optional soulbound batch minting
    function mintBatch(
        uint256[] memory ids,
        uint256[] memory amounts,
        bool soulbound,
        uint256 nonce,
        bytes memory signature
    ) external signatureCheck(nonce, signature) canMintBatch(_msgSender(), ids, amounts) whenNotPaused {
        __mintBatch(_msgSender(), ids, amounts, soulbound);
    }

    function adminMint(address to, uint256 id, uint256 amount, bool soulbound) external onlyRole(MINTER_ROLE) canMint(to, id, amount) whenNotPaused {
        __mint(to, id, amount, soulbound);
    }

    function adminMintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bool soulbound
    ) public onlyRole(MINTER_ROLE) canMintBatch(to, ids, amounts) whenNotPaused {
        __mintBatch(to, ids, amounts, soulbound);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public virtual override soulboundCheck(_from, _to, _id, _amount) {
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual override soulboundCheckBatch(_from, _to, _ids, _amounts) {
        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
    }

    function burn(address to, uint256 tokenId, uint256 amount) public virtual override syncSoulbound(to, tokenId, amount) {
        _burn(to, tokenId, amount);
    }

    function burnBatch(address to, uint256[] memory tokenIds, uint256[] memory amounts) public virtual override syncBatchSoulbound(to, tokenIds, amounts) {
        _burnBatch(to, tokenIds, amounts);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, ERC2981, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        if (!tokenExists[tokenId]) {
            revert("Token not exist");
        }
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : baseURI;
    }

    function updateBaseUri(string memory _baseURI) external onlyRole(MANAGER_ROLE) {
        baseURI = _baseURI;
    }

    function setRoyaltyInfo(address receiver, uint96 feeBasisPoints) external onlyRole(MANAGER_ROLE) {
        _setDefaultRoyalty(receiver, feeBasisPoints);
    }

    function updateWhitelistAddress(address _address, bool _isWhitelisted) external onlyRole(MANAGER_ROLE) {
        _updateWhitelistAddress(_address, _isWhitelisted);
    }

    function recoverAddress(address to, uint256 nonce, bytes memory signature) private pure returns (address) {
        bytes32 message = keccak256(abi.encodePacked(to, nonce));
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(hash, signature);
        return signer;
    }

    function verifySignature(address to, uint256 nonce, bytes memory signature) private returns (bool) {
        if (usedSignatures[signature]) revert("Signature already used");

        address signer = recoverAddress(to, nonce, signature);
        if (whitelistSigners[signer]) {
            usedSignatures[signature] = true;
            return true;
        } else {
            return false;
        }
    }

    function adminVerifySignature(address to, uint256 nonce, bytes memory signature) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool) {
        return verifySignature(to, nonce, signature);
    }

    function setSigner(address _signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[_signer] = true;
        emit SignerAdded(_signer);
    }

    function removeSigner(address signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistSigners[signer] = false;
        emit SignerRemoved(signer);
    }
}
