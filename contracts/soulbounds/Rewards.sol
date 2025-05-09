// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// @author Summon.xyz Team - https://summon.xyz
// @contributors: [ @ogarciarevett, @vasinl124]
//....................................................................................................................................................
//....................&&&&&&..........................................................................................................................
//..................&&&&&&&&&&&.......................................................................................................................
//..............X.....&&&&&&&&&&&&....................................................................................................................
//............&&&&&&.....&&&&&&&&&&&..................................................................................................................
//............&&&&&&&&&.....&&&&&.....................................................................................................................
//............&&&&&&&&&&&&.........&.............&&&&&&&&&&&&..&&&&....&&&&.&&&&&&&&..&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&&&&&.&&&&&....&&&&...........
//...............&&&&&&&&&&&&.....&&$............&&&&..........&&&&....&&&&.&&&&&&&&.&&&&&&&&..&&&&&&&&.&&&&&&&&.&&&&&&&&&&&&.&&&&&&&..&&&&...........
//............&.....&&&&&&&&&&&&..................&&&&&&&&&&&..&&&&....&&&&.&&&&..&&&&&&.&&&&..&&&&.&&&&&&..&&&&.&&&&....&&&&.&&&&.&&&&&&&&...........
//............&&.......&&&&&&&&&&&&......................&&&&..&&&&&&&&&&&&.&&&&..&&&&&..&&&&..&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&...&&&&&&...........
//................&&&.....&&&&&&&&&&+............&&&&&&&&&&&&...&&&&&&&&&&..&&&&...&&&&..&&&&.&&&&&..&&&&...&&&&.&&&&&&&&&&&&.&&&&....&&&&&...........
//.............&&&&&&&&&.....&&&&&&&..................................................................................................................
//.............&&&&&&&&&&&&.....&&&...................................................................................................................
//.................&&&&&&&&&&&........................................................................................................................
//....................&&&&&&&.........................................................................................................................
//....................................................................................................................................................

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    ERC1155Burnable
} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {
    ERC1155Supply
} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {
    ERC1155Holder
} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {
    ERC721Holder
} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {
    AccessControl
} from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    Initializable
} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import { AccessToken } from "../soulbounds/AccessToken.sol";
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

contract Rewards is
    ERCWhitelistSignature,
    AccessControl,
    Pausable,
    ReentrancyGuard,
    Initializable,
    ERC1155Holder,
    ERC721Holder
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    using Strings for uint256;

    AccessToken private rewardTokenContract;

    uint256[] public itemIds;
    mapping(uint256 => bool) private tokenExists;
    mapping(uint256 => LibItems.RewardToken) public tokenRewards;
    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false
    mapping(uint256 => bool) public isClaimRewardPaused; // tokenId => bool - default is false
    mapping(uint256 => mapping(uint256 => uint256))
        private erc721RewardCurrentIndex; // rewardTokenId => rewardIndex => erc721RewardCurrentIndex
    mapping(uint256 => uint256) public currentRewardSupply; // rewardTokenId => currentRewardSupply

    event TokenAdded(uint256 indexed tokenId);
    event Minted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount,
        bool soulbound
    );
    event Claimed(address indexed to, uint256 indexed tokenId, uint256 amount);

    constructor(address devWallet) {
        if (devWallet == address(0)) {
            revert AddressIsZero();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, devWallet);
    }

    function initialize(
        address _devWallet,
        address _managerWallet,
        address _minterWallet,
        address _rewardTokenAddress
    ) external initializer onlyRole(DEFAULT_ADMIN_ROLE) {
        if (
            _devWallet == address(0) ||
            _managerWallet == address(0) ||
            _minterWallet == address(0) ||
            _rewardTokenAddress == address(0)
        ) {
            revert AddressIsZero();
        }

        rewardTokenContract = AccessToken(_rewardTokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, _devWallet);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(MANAGER_ROLE, _managerWallet);
        _grantRole(MINTER_ROLE, _minterWallet);
        _addWhitelistSigner(_devWallet);
    }

    function updateRewardTokenContract(
        address _rewardTokenAddress
    ) external onlyRole(DEV_CONFIG_ROLE) {
        if (_rewardTokenAddress == address(0)) {
            revert AddressIsZero();
        }

        rewardTokenContract = AccessToken(_rewardTokenAddress);
    }

    function isTokenExist(uint256 _tokenId) public view returns (bool) {
        if (!tokenExists[_tokenId]) {
            return false;
        }
        return true;
    }

    function decodeData(
        bytes calldata _data
    )
        public
        view
        onlyRole(DEV_CONFIG_ROLE)
        returns (address, uint256, uint256[] memory)
    {
        return _decodeData(_data);
    }

    function _decodeData(
        bytes calldata _data
    ) private pure returns (address, uint256, uint256[] memory) {
        (
            address contractAddress,
            uint256 chainId,
            uint256[] memory _itemIds
        ) = abi.decode(_data, (address, uint256, uint256[]));
        return (contractAddress, chainId, _itemIds);
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function _validateTokenInputs(
        LibItems.RewardToken calldata _token
    ) private view {
        if (_token.maxSupply == 0) {
            revert InvalidAmount();
        }

        if (
            bytes(_token.tokenUri).length == 0 ||
            _token.rewards.length == 0 ||
            _token.tokenId == 0
        ) {
            revert InvalidInput();
        }

        if (isTokenExist(_token.tokenId)) {
            revert DupTokenId();
        }

        for (uint256 i = 0; i < _token.rewards.length; i++) {
            LibItems.Reward memory reward = _token.rewards[i];
            if (reward.rewardType != LibItems.RewardType.ETHER) {
                if (reward.rewardTokenAddress == address(0)) {
                    revert AddressIsZero();
                }
            }

            if (reward.rewardType == LibItems.RewardType.ERC721) {
                if (
                    reward.rewardTokenIds.length == 0 ||
                    reward.rewardTokenIds.length !=
                    reward.rewardAmount * _token.maxSupply
                ) {
                    revert InvalidInput();
                }
            }

            if (
                reward.rewardType != LibItems.RewardType.ERC721 &&
                reward.rewardAmount == 0
            ) {
                revert InvalidAmount();
            }
        }
    }

    function _calculateETHRequiredForToken(
        LibItems.RewardToken calldata _token
    ) private pure returns (uint256) {
        uint256 totalETHRequired;
        for (uint256 i = 0; i < _token.rewards.length; i++) {
            LibItems.Reward memory reward = _token.rewards[i];
            if (reward.rewardType == LibItems.RewardType.ETHER) {
                totalETHRequired += reward.rewardAmount;
            }
        }
        return totalETHRequired * _token.maxSupply;
    }

    function _createTokenAndDepositRewards(
        LibItems.RewardToken calldata _token
    ) private {
        // have to approve all the assets first
        // Validate token inputs
        _validateTokenInputs(_token);
        tokenRewards[_token.tokenId] = _token;
        tokenExists[_token.tokenId] = true;
        itemIds.push(_token.tokenId);
        rewardTokenContract.addNewToken(_token.tokenId);

        // Transfer rewards
        address _from = _msgSender();
        address _to = address(this);

        for (uint256 i = 0; i < _token.rewards.length; i++) {
            LibItems.Reward memory reward = _token.rewards[i];
            if (reward.rewardType == LibItems.RewardType.ERC20) {
                IERC20 token = IERC20(reward.rewardTokenAddress);
                SafeERC20.safeTransferFrom(
                    token,
                    _from,
                    _to,
                    reward.rewardAmount * _token.maxSupply
                );
            } else if (reward.rewardType == LibItems.RewardType.ERC721) {
                IERC721 token = IERC721(reward.rewardTokenAddress);
                for (uint256 j = 0; j < reward.rewardTokenIds.length; j++) {
                    _transferERC721(
                        token,
                        _from,
                        _to,
                        reward.rewardTokenIds[j]
                    );
                }
            } else if (reward.rewardType == LibItems.RewardType.ERC1155) {
                IERC1155 token = IERC1155(reward.rewardTokenAddress);
                _transferERC1155(
                    token,
                    _from,
                    _to,
                    reward.rewardTokenId,
                    reward.rewardAmount * _token.maxSupply
                );
            }
        }

        emit TokenAdded(_token.tokenId);
    }

    function createTokenAndDepositRewards(
        LibItems.RewardToken calldata _token
    ) public payable onlyRole(MANAGER_ROLE) {
        uint256 _ethRequired = _calculateETHRequiredForToken(_token);

        if (msg.value < _ethRequired) {
            revert InsufficientBalance();
        }

        _createTokenAndDepositRewards(_token);
    }

    function createMultipleTokensAndDepositRewards(
        LibItems.RewardToken[] calldata _tokens
    ) external payable onlyRole(MANAGER_ROLE) {
        uint256 totalETHRequired;

        // Calculate the total ETH required for all tokens
        for (uint256 i = 0; i < _tokens.length; i++) {
            totalETHRequired += _calculateETHRequiredForToken(_tokens[i]);
        }

        // Check if the provided ETH is enough
        if (msg.value < totalETHRequired) {
            revert InsufficientBalance();
        }

        // Create tokens and deposit rewards
        for (uint256 i = 0; i < _tokens.length; i++) {
            _createTokenAndDepositRewards(_tokens[i]);
        }
    }

    function updateTokenMintPaused(
        uint256 _tokenId,
        bool _isTokenMintPaused
    ) public onlyRole(MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isTokenMintPaused;
    }

    function updateClaimRewardPaused(
        uint256 _tokenId,
        bool _isClaimRewardPaused
    ) public onlyRole(MANAGER_ROLE) {
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

        address _from = address(this);

        if (_rewardType == LibItems.RewardType.ETHER) {
            _transferEther(payable(_to), _amounts[0]);
        } else if (_rewardType == LibItems.RewardType.ERC20) {
            _transferERC20(IERC20(_tokenAddress), _to, _amounts[0]);
        } else if (_rewardType == LibItems.RewardType.ERC721) {
            IERC721 token = IERC721(_tokenAddress);
            for (uint256 i = 0; i < _tokenIds.length; i++) {
                _transferERC721(token, _from, _to, _tokenIds[i]);
            }
        } else if (_rewardType == LibItems.RewardType.ERC1155) {
            if (_tokenIds.length != _amounts.length) {
                revert InvalidLength();
            }
            for (uint256 i = 0; i < _tokenIds.length; i++) {
                _transferERC1155(
                    IERC1155(_tokenAddress),
                    _from,
                    _to,
                    _tokenIds[i],
                    _amounts[i]
                );
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

    function _transferERC20(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) private {
        uint256 balanceInContract = _token.balanceOf(address(this));
        if (balanceInContract < _amount) {
            revert InsufficientBalance();
        }

        SafeERC20.safeTransfer(_token, _to, _amount);
    }

    function _transferERC721(
        IERC721 _token,
        address _from,
        address _to,
        uint256 _tokenId
    ) private {
        _token.safeTransferFrom(_from, _to, _tokenId);
    }

    function _transferERC1155(
        IERC1155 _token,
        address _from,
        address _to,
        uint256 _tokenId,
        uint256 _amount
    ) private {
        _token.safeTransferFrom(_from, _to, _tokenId, _amount, "");
    }

    function claimReward(uint256 _tokenId) external nonReentrant whenNotPaused {
        _claimReward(_msgSender(), _tokenId);
    }

    function claimRewards(
        uint256[] calldata _tokenIds
    ) external nonReentrant whenNotPaused {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _claimReward(_msgSender(), _tokenIds[i]);
        }
    }

    function adminClaimReward(
        address _to,
        uint256[] calldata _tokenIds
    ) external onlyRole(MANAGER_ROLE) whenNotPaused {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _claimReward(_to, _tokenIds[i]);
        }
    }

    function _claimReward(address _to, uint256 _rewardTokenId) private {
        if (isClaimRewardPaused[_rewardTokenId]) {
            revert ClaimRewardPaused();
        }

        if (_to == address(0)) {
            revert AddressIsZero();
        }

        // check if the user has the reward token to redeem or not
        if (rewardTokenContract.balanceOf(_to, _rewardTokenId) == 0) {
            revert InsufficientBalance();
        }

        // then burn the reward token
        rewardTokenContract.whitelistBurn(_to, _rewardTokenId, 1);

        _distributeReward(_to, _rewardTokenId);
    }

    function _distributeReward(address _to, uint256 _rewardTokenId) private {
        LibItems.RewardToken memory _rewardToken = tokenRewards[_rewardTokenId];
        LibItems.Reward[] memory rewards = _rewardToken.rewards;

        for (uint256 i = 0; i < rewards.length; i++) {
            LibItems.Reward memory reward = rewards[i];
            address _from = address(this);

            if (reward.rewardType == LibItems.RewardType.ETHER) {
                _transferEther(payable(_to), reward.rewardAmount);
            } else if (reward.rewardType == LibItems.RewardType.ERC20) {
                _transferERC20(
                    IERC20(reward.rewardTokenAddress),
                    _to,
                    reward.rewardAmount
                );
            } else if (reward.rewardType == LibItems.RewardType.ERC721) {
                uint256 currentIndex = erc721RewardCurrentIndex[_rewardTokenId][
                    i
                ];
                uint256[] memory tokenIds = reward.rewardTokenIds;
                for (uint256 j = 0; j < reward.rewardAmount; j++) {
                    if (currentIndex >= tokenIds.length) {
                        revert InsufficientBalance();
                    }
                    _transferERC721(
                        IERC721(reward.rewardTokenAddress),
                        _from,
                        _to,
                        tokenIds[currentIndex + j]
                    );
                }

                erc721RewardCurrentIndex[_rewardTokenId][i] += reward
                    .rewardAmount;
            } else if (reward.rewardType == LibItems.RewardType.ERC1155) {
                _transferERC1155(
                    IERC1155(reward.rewardTokenAddress),
                    _from,
                    _to,
                    reward.rewardTokenId,
                    reward.rewardAmount
                );
            }
        }

        emit Claimed(_to, _rewardTokenId, 1);
    }

    function _mintAndClaimRewardTokenBatch(
        address to,
        uint256[] memory _tokenIds,
        uint256 _amount,
        bool soulbound,
        bool isClaimReward
    ) private {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _mintAndClaimRewardToken(
                to,
                _tokenIds[i],
                _amount,
                soulbound,
                isClaimReward
            );
        }
    }

    function _mintAndClaimRewardToken(
        address to,
        uint256 _tokenId,
        uint256 _amount,
        bool soulbound,
        bool isClaimReward
    ) private {
        if (to == address(0)) {
            revert AddressIsZero();
        }

        if (!isTokenExist(_tokenId)) {
            revert TokenNotExist();
        }

        if (isTokenMintPaused[_tokenId]) {
            revert MintPaused();
        }

        if (_amount == 0) {
            revert InvalidAmount();
        }

        uint256 currentSupply = currentRewardSupply[_tokenId] + _amount;
        currentRewardSupply[_tokenId] += _amount;

        if (currentSupply > tokenRewards[_tokenId].maxSupply) {
            revert ExceedMaxSupply();
        }

        // claim the reward
        if (isClaimReward) {
            for (uint256 i = 0; i < _amount; i++) {
                _distributeReward(to, _tokenId);
            }
        } else {
            // mint reward token
            rewardTokenContract.adminMintId(to, _tokenId, _amount, soulbound);
            emit Minted(to, _tokenId, _amount, soulbound);
        }
    }

    function _verifyContractChainIdAndDecode(
        bytes calldata data
    ) private view returns (uint256[] memory) {
        uint256 currentChainId = getChainID();
        (
            address contractAddress,
            uint256 chainId,
            uint256[] memory tokenIds
        ) = _decodeData(data);

        if (chainId != currentChainId || contractAddress != address(this)) {
            revert InvalidInput();
        }
        return tokenIds;
    }

    function getTokenDetails(
        uint256 tokenId
    )
        public
        view
        returns (
            string memory tokenUri,
            uint256 maxSupply,
            LibItems.RewardType[] memory rewardTypes,
            uint256[] memory rewardAmounts,
            address[] memory rewardTokenAddresses,
            uint256[][] memory rewardTokenIds,
            uint256[] memory rewardTokenId
        )
    {
        tokenUri = tokenRewards[tokenId].tokenUri;
        maxSupply = tokenRewards[tokenId].maxSupply;
        LibItems.Reward[] memory rewards = tokenRewards[tokenId].rewards;

        rewardTypes = new LibItems.RewardType[](rewards.length);
        rewardAmounts = new uint256[](rewards.length);
        rewardTokenAddresses = new address[](rewards.length);
        rewardTokenIds = new uint256[][](rewards.length);
        rewardTokenId = new uint256[](rewards.length);

        for (uint256 i = 0; i < rewards.length; i++) {
            rewardTypes[i] = rewards[i].rewardType;
            rewardAmounts[i] = rewards[i].rewardAmount;
            rewardTokenAddresses[i] = rewards[i].rewardTokenAddress;
            rewardTokenIds[i] = rewards[i].rewardTokenIds;
            rewardTokenId[i] = rewards[i].rewardTokenId;
        }
    }

    function mint(
        bytes calldata data,
        bool isSoulbound,
        uint256 nonce,
        bytes calldata signature,
        bool isClaimReward
    )
        external
        nonReentrant
        signatureCheck(_msgSender(), nonce, data, signature)
        whenNotPaused
    {
        uint256[] memory _tokenIds = _verifyContractChainIdAndDecode(data);
        _mintAndClaimRewardTokenBatch(
            _msgSender(),
            _tokenIds,
            1,
            isSoulbound,
            isClaimReward
        );
    }

    function adminMint(
        address to,
        bytes calldata data,
        bool isSoulbound,
        bool isClaimReward
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        uint256[] memory _tokenIds = _verifyContractChainIdAndDecode(data);
        _mintAndClaimRewardTokenBatch(
            to,
            _tokenIds,
            1,
            isSoulbound,
            isClaimReward
        );
    }

    function adminMintById(
        address toAddress,
        uint256 _tokenId,
        uint256 _amount,
        bool isSoulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        _mintAndClaimRewardToken(
            toAddress,
            _tokenId,
            _amount,
            isSoulbound,
            false
        );
    }

    function adminBatchMintById(
        address[] calldata toAddresses,
        uint256 _tokenId,
        uint256[] calldata _amounts,
        bool isSoulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        if (toAddresses.length != _amounts.length) {
            revert InvalidLength();
        }

        for (uint256 i = 0; i < toAddresses.length; i++) {
            _mintAndClaimRewardToken(
                toAddresses[i],
                _tokenId,
                _amounts[i],
                isSoulbound,
                false
            );
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
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

    function addWhitelistSigner(
        address _signer
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _addWhitelistSigner(_signer);
    }

    function removeWhitelistSigner(
        address signer
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _removeWhitelistSigner(signer);
    }

    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
