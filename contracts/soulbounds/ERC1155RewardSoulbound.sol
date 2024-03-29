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

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC1155Burnable } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import { ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { Achievo1155Soulbound } from "../ercs/extensions/Achievo1155Soulbound.sol";
import { ERCWhitelistSignature } from "../ercs/ERCWhitelistSignature.sol";
import { LibItems } from "../libraries/LibItems.sol";

contract ERC1155RewardSoulbound is
    ERC1155Burnable,
    ERC1155Supply,
    Achievo1155Soulbound,
    ERCWhitelistSignature,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    string public name;
    string public symbol;
    using Strings for uint256;

    mapping(uint256 => bool) private tokenExists;
    mapping(uint256 => LibItems.RewardToken) public tokenRewards;
    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false

    uint256[] public itemIds;

    mapping(address => mapping(uint256 => bool)) private tokenIdProcessed;

    event Minted(address indexed to, uint256[] tokenIds, uint256[] amounts, bool soulbound);
    event MintedById(address indexed to, uint256 indexed tokenId, uint256 amount, bool soulbound);
    event TokenAdded(uint256 indexed tokenId);

    constructor(
        string memory _name,
        string memory _symbol,
        bool _isPaused,
        address devWallet
    ) ERC1155("") {
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

    function _decodeData(bytes calldata _data) private view returns (uint256[] memory, uint256[] memory) {
        (uint256[] memory itemIds, uint256[] memory amounts) = abi.decode(_data, (uint256[], uint256[]));
        return (itemIds, amounts);
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function addNewToken(LibItems.RewardToken calldata _token) public onlyRole(DEV_CONFIG_ROLE) {
        require(bytes(_token.tokenUri).length > 0, "InvalidTokenUri");
        require(_token.tokenId != 0, "InvalidTokenId");
        require(_token.rewards.length > 0, "InvalidRewards");

        for (uint256 i = 0; i < _token.rewards.length; i++) {
            LibItems.Reward memory reward = _token.rewards[i];
            if (reward.rewardType != LibItems.RewardType.ETHER) {
                require(reward.rewardTokenAddress != address(0), "InvalidTokenAddress");
            }

            if (reward.rewardType == LibItems.RewardType.ERC721 || 
                reward.rewardType == LibItems.RewardType.ERC1155) {
                require(reward.rewardTokenId != 0, "InvalidRewardTokenId");
            }

            require(reward.rewardAmount > 0, "InvalidRewardAmount")
        }

        if (_token.gatingTokenRequied) {
            require(_token.gatingTokenAddress != address(0), "InvalidGatingTokenAddress");
            require(_token.gatingTokenId, "InvalidGatingTokenAddress");
        }

        tokenRewards[_token.tokenId] = _token;
        tokenExists[_token.tokenId] = true;
        itemIds.push(_token.tokenId);
        emit TokenAdded(_token.tokenId);
    }

    function addNewTokens(LibItems.RewardToken[] calldata _tokens) external onlyRole(DEV_CONFIG_ROLE) {
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

    function changeRewardAmount(uint256 _tokenId, uint256 _newAmount) external onlyRole(DEV_CONFIG_ROLE) {
        // require(tokenExists[_tokenId], "TokenNotExist");
        // require(tokenRewards[_tokenId].rewardAmount != _newAmount, "InvalidAmount");
        // tokenRewards[_tokenId].rewardAmount = _newAmount;
    }

    function updateReward() {
        //
    }

    function updateTokenMintPaused(uint256 _tokenId, bool _isTokenMintPaused) public onlyRole(MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isTokenMintPaused;
    }

    function withdrawAssets(Libitems.RewardType _rewardType, address _tokenAddress, address _to, uint256[] _amounts, uint256 _tokenIds) external onlyRole(MANAGER_ROLE) {
        require(_to != address(0), "InvalidToAddress");
        require(_amount > 0, "InvalidAmount");

        if (_rewardType != RewardType.ETHER) {
            require(_tokenAddress != address(0), "InvalidTokenAddress");
        }

        if (_rewardType == RewardType.ERC20) {
            // ignore _tokenIds
            uint256 _amount = _amounts[0];
            IERC20 token = IERC20(_tokenAddress);
            uint256 balanceInContract = token.balanceOf(address(this));
            require(balanceInContract >= _amount, "InsufficientContractBalance");
            token.transfer(_to, _amount);
        } else if (_rewardType == RewardType.ERC721) {
            // ignore _amounts
            IERC721 token = IERC721(_tokenAddress);
            for (uint256 i = 0; i < _tokenIds.length; i++) {
                uint256 tokenId = _tokenIds[i];
                token.safeTransferFrom(address(this), _to, tokenId);
            }
        } else if (_rewardType == RewardType.ERC1155) {
            // use both _tokenIds and _amounts
            IERC1155 token = IERC1155(_tokenAddress);
            token.safeBatchTransferFrom(address(this), _to, _tokenIds, _amounts, "");
        } else if (_rewardType == RewardType.ETHER) {
            // ignore _tokenIds
            uint256 _amount = _amounts[0];
            require(address(this).balance >= _amount, "InsufficientContractBalance");
            (bool success, ) = address(_to).call{ value: _amount }("");
            require(success, "Transfer failed.");
        }
    }

    function _distributeReward(address to, LibItems.RewardToken memory rewardToken) private {
        Reward[] rewards = rewardToken.rewards;

        for (uint256 i = 0; i < rewards.length; i++) {
            LibItems.Reward memory reward = rewards[i];

            if (reward.rewardType == LibItems.RewardType.ETHER) {
                require(address(this).balance >= reward.rewardAmount, "InsufficientContractBalance");
                (bool success, ) = address(_msgSender()).call{ value: reward.rewardAmount }("");
                require(success, "Transfer failed.");
            } else if (reward.rewardType == LibItems.RewardType.ERC20) {
                IERC20 token = IERC20(reward.rewardTokenAddress);
                uint256 contractBalance = token.balanceOf(address(this));
                require(contractBalance >= reward.rewardAmount, "InsufficientContractBalance");
                token.transfer(_msgSender(), reward.rewardAmount);
            } else if (reward.rewardType == LibItems.RewardType.ERC721) {
                IERC721 token = IERC721(reward.rewardTokenAddress);
                token.safeTransferFrom(address(this), _msgSender(), reward.rewardTokenId);
            } else if (reward.rewardType == LibItems.RewardType.ERC1155) {
                IERC1155 token = IERC1155(reward.rewardTokenAddress);
                token.safeTransferFrom(address(this), _msgSender(), reward.rewardTokenId, reward.rewardAmount, "");
            }
        }
    }

    function adminClaimERC20Reward(
        address to,
        bytes calldata data,
        bytes calldata signature,
        uint256 nonce
    ) public signatureCheck(to, nonce, data, signature) onlyRole(MANAGER_ROLE) {
        require(to != address(0), "InvalidToAddress");
        (uint256[] memory _tokenIds, uint256[] memory _amounts) = _decodeData(data);

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 _id = _tokenIds[i];
            uint256 amount = _amounts[i];
            LibItems.RewardToken memory rewardToken = tokenRewards[_id];

            if (rewardToken.gatingTokenRequied) {
                require(balanceOf(to, rewardToken.gatingTokenId) >= 1, "InsufficientGatingTokenBalance");
                _burn(to, rewardToken.gatingTokenId, 1);
            }

            _distributeReward(to, rewardToken);
        }
    }

    function claimReward(uint256 _tokenId ) public nonReentrant {
        require(balanceOf(_msgSender(), _tokenId) > 0, "InsufficientBalance");
        require(tokenRewards[_tokenId].rewardAmount > 0, "InvalidRewardAmount");

        LibItems.RewardToken memory rewardToken = tokenRewards[_tokenId];

        if (rewardToken.gatingTokenRequied) {
            require(balanceOf(to, rewardToken.gatingTokenId) >= 1, "InsufficientGatingTokenBalance");
            _burn(to, rewardToken.gatingTokenId, 1);
        }

        _distributeReward(_msgSender(), rewardToken);
    }

    function _mintReward(
        address to,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        bool soulbound
    ) private {
        require(_tokenIds.length > 0, "InvalidInput");
        require(_amounts.length > 0, "InvalidInput");

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 _id = _tokenIds[i];
            uint256 amount = _amounts[i];
            isTokenExist(_id);        
            if (isTokenMintPaused[_id]) {
                revert("TokenMintPaused");
            }

            require(amount > 0, "InvalidAmount");

            LibItems.RewardToken memory rewardToken = tokenRewards[_id];
            if (rewardToken.gatingTokenRequied) {
                require(balanceOf(to, rewardToken.gatingTokenId) >= 1, "InsufficientGatingTokenBalance");
                _burn(to, rewardToken.gatingTokenId, 1);
            }

            if (soulbound) {
                _soulbound(to, _id, amount);
            }

            _mint(to, _id, amount, "");
        }
        emit Minted(to, _tokenIds, _amounts, soulbound);
    }

    function mint(
        bytes calldata data,
        bool soulbound,
        bool claimReward,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant signatureCheck(_msgSender(), nonce, data, signature) whenNotPaused {
        (uint256[] memory _tokenIds, uint256[] memory _amounts) = _decodeData(data);
        _mintReward(_msgSender(), _tokenIds, _amounts, soulbound);
    }

    function adminMint(address to, bytes calldata data, bool soulbound) external onlyRole(MINTER_ROLE) whenNotPaused {
        (uint256[] memory _tokenIds, uint256[] memory _amounts) = _decodeData(data);
        _mintReward(to, _tokenIds, _amounts, soulbound);
    }

    function adminBatchMintById(
        address[] calldata addresses,
        uint256 id,
        uint256[] calldata amounts,
        bool[] calldata soulbounds
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(addresses.length == amounts.length, "InvalidInput");
        require(addresses.length == soulbounds.length, "InvalidInput");
        for (uint256 i = 0; i < addresses.length; i++) {
            adminMintById(addresses[i], defaultRewardId, amounts[i], soulbounds[i]);
        }
    }

    function adminMintById(
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
        emit MintedById(to, id, amount, soulbound);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155, ERC1155Supply) {
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
        ERC1155Burnable.burn(to, tokenId, amount);
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

        ERC1155Burnable.burnBatch(to, tokenIds, amounts);

        // Reset processed status after the transfer is completed
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 id = tokenIds[i];
            tokenIdProcessed[to][id] = false;
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
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
}
