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
import { ERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import { ERC721Holder } from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import { LeanERC1155Soulbound } from "../soulbounds/LeanERC1155Soulbound.sol";
import { ERCWhitelistSignature } from "../ercs/ERCWhitelistSignature.sol";
import { LibItems } from "../libraries/LibItems.sol";

error AddressIsZero();
error InvalidTokenId();
error InvalidAmount();
error ExceedMaxSupply();
error InvalidLength();
error TokenNotExist();
error InvalidInput();
error InsufficientBalance();
error TransferFailed();
error MintPaused();
error ClaimRewardPaused();
error DupTokenId();

contract LootDropHQ is
    ERCWhitelistSignature,
    AccessControl,
    Pausable,
    ReentrancyGuard,
    Initializable,
    ERC1155Receiver,
    ERC721Holder
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    using Strings for uint256;

    LeanERC1155Soulbound private rewardTokenContract;

    uint256[] public itemIds;
    mapping(uint256 => bool) private tokenExists;
    mapping(uint256 => LibItems.RewardToken) public tokenRewards;
    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false
    mapping(uint256 => bool) public isClaimRewardPaused; // tokenId => bool - default is false
    mapping(address => mapping(uint256 => bool)) private tokenIdProcessed;
    mapping(uint256 => mapping(uint256 => uint256)) private erc721RewardCurrentIndex; // rewardTokenId => rewardIndex => erc721RewardCurrentIndex
    mapping(uint256 => uint256) private currentRewardSupply; // rewardTokenId => currentRewardSupply

    event TokenAdded(uint256 indexed tokenId);
    event TokenUpdated(uint256 indexed tokenId);

    constructor(address devWallet) {
        _grantRole(DEFAULT_ADMIN_ROLE, devWallet);
    }

    function initialize(
        address _devWallet,
        address _rewardTokenAddress
    ) external initializer onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_devWallet == address(0) || _rewardTokenAddress == address(0)) {
            revert AddressIsZero();
        }

        rewardTokenContract = LeanERC1155Soulbound(_rewardTokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, _devWallet);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(MINTER_ROLE, _devWallet);
        _grantRole(MANAGER_ROLE, _devWallet);
        _addWhitelistSigner(_devWallet);
    }

    function updateRewardTokenContract(address _rewardTokenAddress) external onlyRole(DEV_CONFIG_ROLE) {
        if (_rewardTokenAddress == address(0)) {
            revert AddressIsZero();
        }

        rewardTokenContract = LeanERC1155Soulbound(_rewardTokenAddress);
    }

    function isTokenExist(uint256 _tokenId) public view returns (bool) {
        if (!tokenExists[_tokenId]) {
            revert TokenNotExist();
        }
        return true;
    }

    function decodeData(
        bytes calldata _data
    ) public view onlyRole(DEV_CONFIG_ROLE) returns (uint256[] memory, uint256[] memory) {
        return _decodeData(_data);
    }

    function _decodeData(bytes calldata _data) private pure returns (uint256[] memory, uint256[] memory) {
        (uint256[] memory tokenIds, uint256[] memory amounts) = abi.decode(_data, (uint256[], uint256[]));
        return (tokenIds, amounts);
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function _validateTokenInputs(LibItems.RewardToken calldata _token) private pure {
        if (bytes(_token.tokenUri).length == 0 || _token.rewards.length == 0 || _token.tokenId == 0) {
            revert InvalidInput();
        }

        for (uint256 i = 0; i < _token.rewards.length; i++) {
            LibItems.Reward memory reward = _token.rewards[i];
            if (reward.rewardType != LibItems.RewardType.ETHER) {
                if (reward.rewardTokenAddress == address(0)) {
                    revert AddressIsZero();
                }
            }

            if (reward.rewardType == LibItems.RewardType.ERC721) {
                if (reward.rewardTokenIds.length == 0) {
                    revert InvalidInput();
                }
            }

            if (reward.rewardType == LibItems.RewardType.ERC1155) {
                if (reward.rewardTokenId == 0) {
                    revert InvalidTokenId();
                }
            }

            if (reward.rewardType != LibItems.RewardType.ERC721 && reward.rewardAmount == 0) {
                revert InvalidAmount();
            }
        }

        if (_token.gatingTokenRequired) {
            if (
                _token.gatingTokenAddress == address(0) ||
                _token.gatingTokenId == 0 ||
                _token.gatingTokenType == LibItems.GatingTokenType.NONE
            ) {
                revert InvalidInput();
            }
        }
    }

    function addNewToken(LibItems.RewardToken calldata _token) public onlyRole(DEV_CONFIG_ROLE) {
        _validateTokenInputs(_token);
        tokenRewards[_token.tokenId] = _token;
        tokenExists[_token.tokenId] = true;
        itemIds.push(_token.tokenId);

        LibItems.TokenCreate memory tokenCreate = LibItems.TokenCreate(_token.tokenId, _token.tokenUri);
        rewardTokenContract.addNewToken(tokenCreate);

        emit TokenAdded(_token.tokenId);
    }

    function addNewTokens(LibItems.RewardToken[] calldata _tokens) external onlyRole(DEV_CONFIG_ROLE) {
        for (uint256 i = 0; i < _tokens.length; i++) {
            addNewToken(_tokens[i]);
        }
    }

    function updateRewardToken(
        uint256 _tokenId,
        LibItems.RewardToken calldata _updatedToken
    ) public onlyRole(DEV_CONFIG_ROLE) {
        isTokenExist(_tokenId);
        _validateTokenInputs(_updatedToken);
        tokenRewards[_tokenId] = _updatedToken;
        rewardTokenContract.updateTokenUri(_tokenId, _updatedToken.tokenUri);

        emit TokenUpdated(_tokenId);
    }

    function updateRewardTokens(
        uint256[] calldata _tokenIds,
        LibItems.RewardToken[] calldata _updatedTokens
    ) external onlyRole(DEV_CONFIG_ROLE) {
        for (uint256 i = 0; i < _updatedTokens.length; i++) {
            updateRewardToken(_tokenIds[i], _updatedTokens[i]);
        }
    }

    function updateTokenMintPaused(uint256 _tokenId, bool _isTokenMintPaused) public onlyRole(MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isTokenMintPaused;
    }

    function updateClaimRewardPaused(uint256 _tokenId, bool _isClaimRewardPaused) public onlyRole(MANAGER_ROLE) {
        isClaimRewardPaused[_tokenId] = _isClaimRewardPaused;
    }

    /**
     * @dev Allows the contract owner to withdraw all available assets from the contract.
     * @param _rewardType The type of reward to withdraw.
     * @param _to The address to send the assets to.
     * @param _tokenAddress The address of the token to withdraw. (required for ERC20, ERC721, and ERC1155 tokens)
     * @param _tokenIds The token IDs to withdraw. (required for ERC721 and ERC1155 tokens)
     * @param _amounts The amounts to withdraw. (required for ETHER, ERC20, and ERC1155 tokens)
     */
    function withdrawAssets(
        LibItems.RewardType _rewardType,
        address _to,
        address _tokenAddress, // required for ERC20, ERC721, and ERC1155
        uint256[] calldata _tokenIds, // required for ERC721 and ERC1155
        uint256[] calldata _amounts // required for ETHER, ERC20, and ERC1155
    ) external onlyRole(MANAGER_ROLE) {
        if (_to == address(0)) {
            revert AddressIsZero();
        }

        if (_rewardType == LibItems.RewardType.ETHER) {
            _transferEther(payable(_to), _amounts[0]);
        } else if (_rewardType == LibItems.RewardType.ERC20) {
            _transferERC20(IERC20(_tokenAddress), _to, _amounts[0]);
        } else if (_rewardType == LibItems.RewardType.ERC721) {
            IERC721 token = IERC721(_tokenAddress);
            for (uint256 i = 0; i < _tokenIds.length; i++) {
                _transferERC721(token, _to, _tokenIds[i]);
            }
        } else if (_rewardType == LibItems.RewardType.ERC1155) {
            for (uint256 i = 0; i < _tokenIds.length; i++) {
                _transferERC1155(IERC1155(_tokenAddress), _to, _tokenIds[i], _amounts[i]);
            }
        }
    }

    function _transferEther(address payable _to, uint256 _amount) private {
        if (address(this).balance < _amount) {
            revert InsufficientBalance();
        }

        (bool success, ) = _to.call{ value: _amount }("");
        if (!success) {
            revert TransferFailed();
        }
    }

    function _transferERC20(IERC20 _token, address _to, uint256 _amount) private {
        uint256 balanceInContract = _token.balanceOf(address(this));
        if (balanceInContract < _amount) {
            revert InsufficientBalance();
        }

        _token.transfer(_to, _amount);
    }

    function _transferERC721(IERC721 _token, address _to, uint256 _tokenId) private {
        _token.safeTransferFrom(address(this), _to, _tokenId);
    }

    function _transferERC1155(IERC1155 _token, address _to, uint256 _tokenId, uint256 _amount) private {
        _token.safeTransferFrom(address(this), _to, _tokenId, _amount, "");
    }

    function claimReward(uint256 _tokenId) external nonReentrant {
        _claimReward(_msgSender(), _tokenId);
    }

    function adminClaimReward(address _to, uint256[] calldata _tokenIds) external onlyRole(MANAGER_ROLE) {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _claimReward(_to, _tokenIds[i]);
        }
    }

    function _claimReward(address _to, uint256 _tokenId) private {
        if (isClaimRewardPaused[_tokenId]) {
            revert ClaimRewardPaused();
        }

        if (_to == address(0)) {
            revert AddressIsZero();
        }

        // check if the user has the reward token to redeem or not
        if (rewardTokenContract.balanceOf(_to, _tokenId) == 0) {
            revert InsufficientBalance();
        }

        LibItems.RewardToken memory _rewardToken = tokenRewards[_tokenId];
        LibItems.Reward[] memory rewards = _rewardToken.rewards;

        for (uint256 i = 0; i < rewards.length; i++) {
            LibItems.Reward memory reward = rewards[i];

            if (reward.rewardType == LibItems.RewardType.ETHER) {
                _transferEther(payable(_to), reward.rewardAmount);
            } else if (reward.rewardType == LibItems.RewardType.ERC20) {
                _transferERC20(IERC20(reward.rewardTokenAddress), _to, reward.rewardAmount);
            } else if (reward.rewardType == LibItems.RewardType.ERC721) {
                uint256 currentIndex = erc721RewardCurrentIndex[_tokenId][i];
                uint256[] memory tokenIds = reward.rewardTokenIds;
                if (currentIndex >= tokenIds.length) {
                    revert InsufficientBalance();
                }
                _transferERC721(IERC721(reward.rewardTokenAddress), _to, tokenIds[currentIndex]);
                erc721RewardCurrentIndex[_tokenId][i]++;
            } else if (reward.rewardType == LibItems.RewardType.ERC1155) {
                _transferERC1155(IERC1155(reward.rewardTokenAddress), _to, reward.rewardTokenId, reward.rewardAmount);
            }
        }
    }

    function _mintAndClaimRewardTokenBatch(
        address to,
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        bool soulbound,
        bool isClaimReward
    ) private {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _mintAndClaimRewardToken(to, _tokenIds[i], _amounts[i], soulbound, isClaimReward);
        }
    }

    function _mintAndClaimRewardToken(
        address to,
        uint256 _tokenId,
        uint256 _amount,
        bool soulbound,
        bool isClaimReward
    ) private {
        isTokenExist(_tokenId);
        if (isTokenMintPaused[_tokenId]) {
            revert MintPaused();
        }

        if (
            tokenRewards[_tokenId].maxSupply > 0 &&
            currentRewardSupply[_tokenId] + _amount > tokenRewards[_tokenId].maxSupply
        ) {
            revert ExceedMaxSupply();
        }

        if (_amount == 0) {
            revert InvalidAmount();
        }

        LibItems.RewardToken memory rewardToken = tokenRewards[_tokenId];

        if (rewardToken.gatingTokenRequired) {
            // TODO check if already claimed or not...
            // check if the user has the gating token to mint the reward token or not

            if (rewardToken.gatingTokenType == LibItems.GatingTokenType.ERC721) {
                IERC721 erc721Token = IERC721(rewardToken.gatingTokenAddress);
                if (erc721Token.ownerOf(rewardToken.gatingTokenId) != to) {
                    revert InsufficientBalance();
                }

                // if (rewardToken.requireToBurnGatingToken) {
                //     erc721Token.burn(to, rewardToken.gatingTokenId, 1);
                // }
            } else if (rewardToken.gatingTokenType == LibItems.GatingTokenType.ERC1155) {
                ERC1155Burnable erc1155Token = ERC1155Burnable(rewardToken.gatingTokenAddress);
                if (erc1155Token.balanceOf(to, rewardToken.gatingTokenId) == 0) {
                    revert InsufficientBalance();
                }
                if (rewardToken.requireToBurnGatingToken) {
                    erc1155Token.burn(to, rewardToken.gatingTokenId, 1);
                }
            }
        }

        // mint reward token
        rewardTokenContract.adminMintId(to, _tokenId, _amount, soulbound);

        // burn and claim the reward
        if (isClaimReward) {
            _claimReward(to, _tokenId);
        }
    }

    function mint(
        bytes calldata data,
        bool isSoulbound,
        uint256 nonce,
        bytes calldata signature,
        bool isClaimReward
    ) external nonReentrant signatureCheck(_msgSender(), nonce, data, signature) whenNotPaused {
        (uint256[] memory _tokenIds, uint256[] memory _amounts) = _decodeData(data);
        _mintAndClaimRewardTokenBatch(_msgSender(), _tokenIds, _amounts, isSoulbound, isClaimReward);
    }

    function adminMint(address to, bytes calldata data, bool soulbound) external onlyRole(MINTER_ROLE) whenNotPaused {
        (uint256[] memory _tokenIds, uint256[] memory _amounts) = _decodeData(data);
        _mintAndClaimRewardTokenBatch(to, _tokenIds, _amounts, soulbound, false);
    }

    function adminMintById(
        address toAddress,
        uint256 _tokenId,
        uint256 _amount,
        bool isSoulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        _mintAndClaimRewardToken(toAddress, _tokenId, _amount, isSoulbound, false);
    }

    function adminBatchMintById(
        address[] calldata toAddresses,
        uint256 _tokenId,
        uint256[] calldata _amounts,
        bool isSoulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        for (uint256 i = 0; i < toAddresses.length; i++) {
            _mintAndClaimRewardToken(toAddresses[i], _tokenId, _amounts[i], isSoulbound, false);
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl, ERC1155Receiver) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) public pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) public pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

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
