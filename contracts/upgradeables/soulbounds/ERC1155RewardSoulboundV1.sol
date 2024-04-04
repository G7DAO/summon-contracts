// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

/**
 * Author: Omar <ogarciarevett>(https://github.com/ogarciarevett)
 * Co-Authors: Max <vasinl124>(https://github.com/vasinl124)
 */

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

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ERC1155Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import { ERCWhitelistSignatureUpgradeable } from "../ercs/ERCWhitelistSignatureUpgradeable.sol";

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {
    ERC1155BurnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import {
    ERC1155SupplyUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";

import { StringsUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import { Achievo1155SoulboundUpgradeable } from "../ercs/extensions/Achievo1155SoulboundUpgradeable.sol";

import { LibItems } from "../../libraries/LibItems.sol";

contract ERC1155RewardSoulboundV1 is
    Initializable,
    ERC1155BurnableUpgradeable,
    ERC1155SupplyUpgradeable,
    Achievo1155SoulboundUpgradeable,
    ERCWhitelistSignatureUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    string public name;
    string public symbol;
    using StringsUpgradeable for uint256;

    uint256 public MAX_PER_MINT;
    uint256 public defaultRewardId;

    mapping(uint256 => bool) private tokenExists;
    mapping(uint256 => LibItems.RewardTokenOld) public tokenRewards;
    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false

    uint256[] public itemIds;

    mapping(address => mapping(uint256 => bool)) private tokenIdProcessed;

    event Minted(address indexed to, uint256[] tokenIds, uint256 amount, bool soulbound);
    event MintedId(address indexed to, uint256 indexed tokenId, uint256 amount, bool soulbound);
    event TokenAdded(uint256 indexed tokenId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        uint256 _defaultRewardId,
        bool _isPaused,
        address devWallet
    ) public initializer {
        __ERC1155_init("");
        __ReentrancyGuard_init();
        __AccessControl_init();
        __Achievo1155SoulboundUpgradable_init();
        __ERCWhitelistSignatureUpgradeable_init();

        require(devWallet != address(0), "AddressIsZero");

        _grantRole(DEFAULT_ADMIN_ROLE, devWallet);
        _grantRole(DEV_CONFIG_ROLE, devWallet);
        _grantRole(MINTER_ROLE, devWallet);
        _grantRole(MANAGER_ROLE, devWallet);
        _addWhitelistSigner(devWallet);

        name = _name;
        symbol = _symbol;
        defaultRewardId = _defaultRewardId;

        if (_isPaused) _pause();
    }

    function isTokenExist(uint256 _tokenId) public view returns (bool) {
        if (!tokenExists[_tokenId]) {
            revert("TokenNotExist");
        }
        return true;
    }

    function decodeData(bytes calldata _data) public view onlyRole(DEV_CONFIG_ROLE) returns (uint256[] memory) {
        return _decodeData(_data);
    }

    function _decodeData(bytes calldata _data) private view returns (uint256[] memory) {
        uint256[] memory itemIds = abi.decode(_data, (uint256[]));
        return itemIds;
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function addNewToken(LibItems.RewardTokenOld calldata _token) public onlyRole(DEV_CONFIG_ROLE) {
        require(bytes(_token.tokenUri).length > 0, "InvalidTokenUri");
        require(_token.tokenId != 0, "InvalidTokenId");
        require(_token.rewardERC20 != address(0), "InvalidRewardERC20");
        tokenRewards[_token.tokenId] = _token;
        tokenExists[_token.tokenId] = true;
        itemIds.push(_token.tokenId);
        emit TokenAdded(_token.tokenId);
    }

    function addNewTokens(LibItems.RewardTokenOld[] calldata _tokens) external onlyRole(DEV_CONFIG_ROLE) {
        for (uint256 i = 0; i < _tokens.length; i++) {
            addNewToken(_tokens[i]);
        }
    }

    function updateTokenUri(uint256 _tokenId, string calldata _tokenUri) public onlyRole(DEV_CONFIG_ROLE) {
        require(bytes(_tokenUri).length > 0, "InvalidTokenUri");
        require(_tokenId != 0, "InvalidTokenId");
        tokenRewards[_tokenId].tokenUri = _tokenUri;
    }

    function batchUpdateTokenUri(
        uint256[] calldata _tokenIds,
        string[] calldata _tokenUris
    ) public onlyRole(DEV_CONFIG_ROLE) {
        require(_tokenIds.length > 0, "InvalidInput");
        require(_tokenIds.length == _tokenUris.length, "InvalidInput");
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            updateTokenUri(_tokenIds[i], _tokenUris[i]);
        }
    }

    function updateTokenMintPaused(uint256 _tokenId, bool _isTokenMintPaused) public onlyRole(MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isTokenMintPaused;
    }

    function adminClaimERC20Reward(
        address to,
        bytes calldata data,
        bytes calldata signature,
        uint256 nonce
    ) public signatureCheck(to, nonce, data, signature) onlyRole(MANAGER_ROLE) {
        require(to != address(0), "InvalidToAddress");
        require(balanceOf(to, defaultRewardId) > 0, "InsufficientRewardBalance");

        uint256[] memory _tokenIds = _decodeData(data);

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            require(tokenRewards[tokenId].rewardAmount > 0, "InvalidRewardAmount");
            require(!tokenRewards[tokenId].isEther, "InvalidRewardType");
            IERC20Upgradeable token = IERC20Upgradeable(tokenRewards[tokenId].rewardERC20);
            uint256 contractBalance = token.balanceOf(address(this));
            require(contractBalance >= tokenRewards[tokenId].rewardAmount, "InsufficientContractBalance");
            token.transfer(to, tokenRewards[tokenId].rewardAmount);
        }

        _burn(to, defaultRewardId, 1);
    }

    function withdrawERC20(address _tokenAddress, address _to, uint256 _amount) external onlyRole(MANAGER_ROLE) {
        require(_tokenAddress != address(0), "InvalidTokenAddress");
        require(_to != address(0), "InvalidToAddress");
        require(_amount > 0, "InvalidAmount");
        IERC20Upgradeable token = IERC20Upgradeable(_tokenAddress);
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= _amount, "InsufficientContractBalance");
        token.transfer(_to, _amount);
    }

    function withdrawETH(address payable _to, uint256 _amount) external onlyRole(MANAGER_ROLE) {
        require(_to != address(0), "InvalidToAddress");
        require(_amount > 0, "InvalidAmount");
        require(address(this).balance >= _amount, "InsufficientContractBalance");

        (bool success, ) = address(_to).call{ value: address(this).balance }("");
        require(success, "Transfer failed.");
    }

    function claimERC20Reward(uint256 _tokenId) public nonReentrant {
        require(balanceOf(_msgSender(), _tokenId) > 0, "InsufficientBalance");
        require(tokenRewards[_tokenId].rewardAmount > 0, "InvalidRewardAmount");
        require(!tokenRewards[_tokenId].isEther, "InvalidRewardType");

        IERC20Upgradeable token = IERC20Upgradeable(tokenRewards[_tokenId].rewardERC20);
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= tokenRewards[_tokenId].rewardAmount, "InsufficientContractBalance");

        token.transfer(_msgSender(), tokenRewards[_tokenId].rewardAmount);
        _burn(_msgSender(), _tokenId, 1);
    }

    function claimETHReward(uint256 _tokenId) public nonReentrant {
        require(balanceOf(_msgSender(), _tokenId) > 0, "InsufficientBalance");
        require(tokenRewards[_tokenId].rewardAmount > 0, "InvalidRewardAmount");
        require(tokenRewards[_tokenId].isEther, "InvalidRewardType");

        require(address(this).balance >= tokenRewards[_tokenId].rewardAmount, "InsufficientContractBalance");

        (bool success, ) = address(_msgSender()).call{ value: tokenRewards[_tokenId].rewardAmount }("");
        require(success, "Transfer failed.");

        _burn(_msgSender(), _tokenId, 1);
    }

    function _mintAndBurnReward(
        address to,
        uint256[] memory _tokenIds,
        uint256 amount,
        bool claimReward,
        bool soulbound
    ) private {
        require(amount > 0, "InvalidAmount");
        require(_tokenIds.length > 0, "InvalidInput");
        require(balanceOf(to, defaultRewardId) >= 1, "InsufficientRewardTokenBalance");
        _burn(to, defaultRewardId, 1);

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 _id = _tokenIds[i];
            isTokenExist(_id);
            if (isTokenMintPaused[_id]) {
                revert("TokenMintPaused");
            }

            if (claimReward) {
                LibItems.RewardTokenOld memory tokenReward = tokenRewards[_id];

                if (!tokenReward.isEther) {
                    IERC20Upgradeable token = IERC20Upgradeable(tokenReward.rewardERC20);
                    uint256 contractBalance = token.balanceOf(address(this));
                    require(contractBalance >= tokenReward.rewardAmount, "InsufficientContractBalance");
                    token.transfer(to, tokenReward.rewardAmount);
                } else {
                    require(address(this).balance >= tokenReward.rewardAmount, "InsufficientContractBalance");

                    (bool success, ) = address(to).call{ value: tokenReward.rewardAmount }("");
                    require(success, "Transfer failed.");
                }
            }

            if (soulbound) {
                _soulbound(to, _id, amount);
            }

            _mint(to, _id, amount, "");
        }
        emit Minted(to, _tokenIds, amount, soulbound);
    }

    function mint(
        bytes calldata data,
        bool soulbound,
        bool claimReward,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant signatureCheck(_msgSender(), nonce, data, signature) whenNotPaused {
        uint256[] memory _tokenIds = _decodeData(data);
        _mintAndBurnReward(_msgSender(), _tokenIds, 1, claimReward, soulbound);
    }

    function adminMint(address to, bytes calldata data, bool soulbound) external onlyRole(MINTER_ROLE) whenNotPaused {
        uint256[] memory _tokenIds = _decodeData(data);
        _mintAndBurnReward(to, _tokenIds, 1, false, soulbound);
    }

    function adminMintDefaultReward(
        address to,
        uint256 amount,
        bool soulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        adminMintId(to, defaultRewardId, amount, soulbound);
    }

    function adminBatchMintDefaultReward(
        address[] calldata addresses,
        uint256[] calldata amounts,
        bool[] calldata soulbounds
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(addresses.length == amounts.length, "InvalidInput");
        require(addresses.length == soulbounds.length, "InvalidInput");
        for (uint256 i = 0; i < addresses.length; i++) {
            adminMintId(addresses[i], defaultRewardId, amounts[i], soulbounds[i]);
        }
    }

    function adminMintId(
        address to,
        uint256 id,
        uint256 amount,
        bool soulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        isTokenExist(id);

        if (isTokenMintPaused[id]) {
            revert("TokenMintPaused");
        }

        if (soulbound) {
            _soulbound(to, id, amount);
        }

        _mint(to, id, amount, "");
        emit MintedId(to, id, amount, soulbound);
    }

    function setDefaultRewardId(uint256 _defaultRewardId) external onlyRole(DEV_CONFIG_ROLE) {
        require(_defaultRewardId != defaultRewardId, "SameDefaultRewardId");
        require(tokenExists[_defaultRewardId], "TokenNotExist");
        defaultRewardId = _defaultRewardId;
    }

    function changeRewardAmount(uint256 _tokenId, uint256 _newAmount) external onlyRole(DEV_CONFIG_ROLE) {
        require(tokenExists[_tokenId], "TokenNotExist");
        require(tokenRewards[_tokenId].rewardAmount != _newAmount, "InvalidAmount");
        tokenRewards[_tokenId].rewardAmount = _newAmount;
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public virtual override soulboundCheckAndSync(_from, _to, _id, _amount, balanceOf(_from, _id)) {
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    )
        public
        virtual
        override
        soulboundCheckAndSyncBatch(_from, _to, _ids, _amounts, balanceOfBatchOneAccount(_from, _ids))
    {
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 id = _ids[i];

            if (tokenIdProcessed[_from][id]) {
                revert("ERC1155: duplicate ID");
            }

            tokenIdProcessed[_from][id] = true;
        }

        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);

        // Reset processed status after the transfer is completed
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 id = _ids[i];
            tokenIdProcessed[_from][id] = false;
        }
    }

    function balanceOfBatchOneAccount(
        address account,
        uint256[] memory ids
    ) public view virtual returns (uint256[] memory) {
        uint256[] memory batchBalances = new uint256[](ids.length);

        for (uint256 i = 0; i < ids.length; ++i) {
            batchBalances[i] = balanceOf(account, ids[i]);
        }

        return batchBalances;
    }

    function burn(
        address to,
        uint256 tokenId,
        uint256 amount
    )
        public
        virtual
        override
        nonReentrant
        soulboundCheckAndSync(to, address(0), tokenId, amount, balanceOf(to, tokenId))
    {
        ERC1155BurnableUpgradeable.burn(to, tokenId, amount);
    }

    function burnBatch(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    )
        public
        virtual
        override
        nonReentrant
        soulboundCheckAndSyncBatch(to, address(0), tokenIds, amounts, balanceOfBatchOneAccount(to, tokenIds))
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 id = tokenIds[i];

            if (tokenIdProcessed[to][id]) {
                revert("ERC1155: duplicate ID");
            }

            tokenIdProcessed[to][id] = true;
        }

        ERC1155BurnableUpgradeable.burnBatch(to, tokenIds, amounts);

        // Reset processed status after the transfer is completed
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 id = tokenIds[i];
            tokenIdProcessed[to][id] = false;
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155Upgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        isTokenExist(tokenId);
        return tokenRewards[tokenId].tokenUri;
    }

    function getAllItems() public view returns (LibItems.TokenReturn[] memory) {
        uint256 totalTokens = itemIds.length;
        LibItems.TokenReturn[] memory tokenReturns = new LibItems.TokenReturn[](totalTokens);

        uint index;
        for (uint i = 0; i < totalTokens; i++) {
            uint256 tokenId = itemIds[i];
            uint256 amount = balanceOf(_msgSender(), tokenId);

            if (amount > 0) {
                LibItems.TokenReturn memory tokenReturn = LibItems.TokenReturn({
                    tokenId: tokenId,
                    tokenUri: uri(tokenId),
                    amount: amount
                });
                tokenReturns[index] = tokenReturn;
                index++;
            }
        }

        // truncate the array
        LibItems.TokenReturn[] memory returnsTruncated = new LibItems.TokenReturn[](index);
        for (uint i = 0; i < index; i++) {
            returnsTruncated[i] = tokenReturns[i];
        }

        return returnsTruncated;
    }

    function updateWhitelistAddress(address _address, bool _isWhitelisted) external onlyRole(DEV_CONFIG_ROLE) {
        _updateWhitelistAddress(_address, _isWhitelisted);
    }

    function adminVerifySignature(
        address to,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) public onlyRole(DEV_CONFIG_ROLE) returns (bool) {
        return _verifySignature(to, nonce, data, signature);
    }

    function addWhitelistSigner(address _signer) external onlyRole(DEV_CONFIG_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(address signer) external onlyRole(DEV_CONFIG_ROLE) {
        _removeWhitelistSigner(signer);
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[38] private __gap;
}
