// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

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

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERCWhitelistSignature } from "../ercs/ERCWhitelistSignature.sol";
import { IItemBound } from "../interfaces/IItemBound.sol";
import { Achievo1155Soulbound } from "../ercs/extensions/Achievo1155Soulbound.sol";

contract LevelsBound is ERC1155, Ownable, ReentrancyGuard, ERCWhitelistSignature, AccessControl, Achievo1155Soulbound {
    mapping(address => uint256) public currentPlayerLevel;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    string public name;
    string public symbol;
    address public itemsNFTAddress;
    bool private mintRandomItemEnabled;

    event RandomItemMinted(address to, bytes data, address itemsNFTAddress);
    event MintRandomItemEnabledChanged(bool enabled, address admin);
    event LevelUp(uint256 newLevel, address account);
    event LevelBurned(uint256 levelBurned, address admin);

    constructor(
        string memory _name,
        string memory _symbol,
        address developerAdmin,
        bool _mintRandomItemEnabled,
        address _itemsNFTAddress
    ) ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, developerAdmin);
        _setupRole(MINTER_ROLE, developerAdmin);
        _setupRole(DEV_CONFIG_ROLE, developerAdmin);
        _addWhitelistSigner(developerAdmin);

        name = _name;
        symbol = _symbol;
        mintRandomItemEnabled = _mintRandomItemEnabled;
        itemsNFTAddress = _itemsNFTAddress;
    }

    function mintLevel(address account, uint256 level, bytes calldata data) private {
        _soulbound(account, level, 1);
        _mint(account, level, 1, "");
        currentPlayerLevel[account] = level;
        if (mintRandomItemEnabled) {
            mintRandomItem(account, data);
        }
        emit LevelUp(level, account);
    }

    function mintRandomItem(address to, bytes calldata data) private {
        IItemBound(itemsNFTAddress).adminMint(to, data, false);
        emit RandomItemMinted(to, data, itemsNFTAddress);
    }

    function adminReplaceLevel(address account, uint256 level) public onlyRole(MINTER_ROLE) {
        require(currentPlayerLevel[account] != level, "Account already has a level");

        // burn first the current level if exists
        if (currentPlayerLevel[account] != 0) {
            burnLevel(account, currentPlayerLevel[account]);
        }
        _soulbound(account, level, 1);
        _mint(account, level, 1, "");
        currentPlayerLevel[account] = level;
        emit LevelUp(level, account);
    }

    function adminBurnLevel(address account, uint256 levelTokenId) public onlyRole(DEV_CONFIG_ROLE) {
        burnLevel(account, levelTokenId);
        currentPlayerLevel[account] = 0; // reset level to 0
        emit LevelBurned(levelTokenId, _msgSender());
    }

    function levelUp(uint256 nonce, bytes calldata data, bytes calldata signature) public nonReentrant {
        require(_verifySignature(_msgSender(), nonce, data, signature), "Invalid signature");
        uint currentLevel = currentPlayerLevel[_msgSender()];
        uint nextLevel = currentLevel + 1;

        if (nextLevel == 1) {
            mintLevel(_msgSender(), 1, data);
            return;
        }
        mintLevel(_msgSender(), nextLevel, data);
        burnLevel(_msgSender(), currentLevel);
    }

    function burnLevel(address account, uint256 tokenId) private nonReentrant {
        _burn(account, tokenId, 1);
    }

    function adminGetAccountLevel(address account) public view onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        return currentPlayerLevel[account];
    }

    function getMyLevel() public view returns (uint256) {
        return currentPlayerLevel[_msgSender()];
    }

    function setMintRandomItemEnabled(bool _mintRandomItemEnabled) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_mintRandomItemEnabled != mintRandomItemEnabled, "Minting random item already set");
        mintRandomItemEnabled = _mintRandomItemEnabled;
        emit MintRandomItemEnabledChanged(_mintRandomItemEnabled, _msgSender());
    }

    function burn(uint256 tokenId, uint256 amount) public nonReentrant {
        revert("You can't burn this token");
        _burn(msg.sender, tokenId, amount);
    }

    function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) public nonReentrant {
        revert("You can't burn more of one of this token");
        _burnBatch(msg.sender, tokenIds, amounts);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public virtual override nonReentrant {
        revert("You can't transfer this token");
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual override nonReentrant {
        revert("You can't transfer this token");
        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl, ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function addWhitelistSigner(address _signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _removeWhitelistSigner(signer);
    }
}
