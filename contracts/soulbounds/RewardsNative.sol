// SPDX-License-Identifier: MIT
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

import {
    AccessControl
} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    ERC1155Holder
} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { AccessToken } from "../soulbounds/AccessToken.sol";
import { LibRewards } from "../libraries/LibRewards.sol";

contract RewardsNative is
    AccessControl,
    Pausable,
    ReentrancyGuard,
    ERC1155Holder
{
    /*//////////////////////////////////////////////////////////////
                               STATE-VARS
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    AccessToken public rewardTokenContract;

    uint256[] public itemIds;
    mapping(uint256 => bool) private tokenExists;
    mapping(uint256 => LibRewards.RewardToken) public tokenRewards;
    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false
    mapping(uint256 => bool) public isClaimRewardPaused; // tokenId => bool - default is false
    mapping(uint256 => uint256) public currentRewardSupply; // rewardTokenId => currentRewardSupply

    /*//////////////////////////////////////////////////////////////
                             ERRORS
    //////////////////////////////////////////////////////////////*/
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

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event TokenAdded(uint256 indexed tokenId);
    event Minted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount,
        bool soulbound
    );
    event Claimed(address indexed to, uint256 indexed tokenId, uint256 amount);

    constructor(
        address _devWallet,
        address _adminWallet,
        address _managerWallet,
        address _minterWallet,
        address _rewardTokenAddress
    ) {
        if (
            _devWallet == address(0) ||
            _managerWallet == address(0) ||
            _minterWallet == address(0) ||
            _rewardTokenAddress == address(0)
        ) {
            revert AddressIsZero();
        }

        rewardTokenContract = AccessToken(_rewardTokenAddress);
        _grantRole(DEV_CONFIG_ROLE, _devWallet);
        _grantRole(DEFAULT_ADMIN_ROLE, _adminWallet);
        _grantRole(MANAGER_ROLE, _managerWallet);
        _grantRole(MINTER_ROLE, _minterWallet);
    }

    /*//////////////////////////////////////////////////////////////
                          EXTERNALS-FUNCTIONS
    //////////////////////////////////////////////////////////////*/
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
        external
        view
        onlyRole(DEV_CONFIG_ROLE)
        returns (address, uint256, uint256[] memory)
    {
        return _decodeData(_data);
    }

    function _dangerous_createTokenAndDepositRewards(
        LibRewards.RewardToken calldata _token
    ) external onlyRole(DEV_CONFIG_ROLE) {
        _createTokenAndDepositRewards(_token);
    }

    function _dangerous_createMultipleTokensAndDepositRewards(
        LibRewards.RewardToken[] calldata _tokens
    ) external onlyRole(DEV_CONFIG_ROLE) {
        // Create tokens and deposit rewards
        for (uint256 i = 0; i < _tokens.length; i++) {
            _createTokenAndDepositRewards(_tokens[i]);
        }
    }

    function createTokenAndMintRewards(
        LibRewards.RewardToken calldata _token,
        address _to,
        uint256 _amount,
        bool _isSoulbound
    ) public onlyRole(MINTER_ROLE) {
        _createTokenAndDepositRewards(_token);
        _mintRewardAccessToken(_to, _token.tokenId, _amount, _isSoulbound);
    }

    function createMultipleTokensAndMintRewards(
        LibRewards.RewardToken[] calldata _tokens,
        address[] calldata users,
        uint256[] calldata amounts,
        bool[] calldata soulbounds
    ) external onlyRole(MINTER_ROLE) {
        if (
            users.length != amounts.length ||
            users.length != soulbounds.length ||
            amounts.length != soulbounds.length ||
            users.length != _tokens.length
        ) {
            revert InvalidLength();
        }
        // Create tokens and deposit rewards
        for (uint256 i = 0; i < _tokens.length; i++) {
            _createTokenAndDepositRewards(_tokens[i]);
            _mintRewardAccessToken(
                users[i],
                _tokens[i].tokenId,
                amounts[i],
                soulbounds[i]
            );
        }
    }

    function createTokenAndDepositRewards(
        LibRewards.RewardToken calldata _token
    ) public payable onlyRole(MANAGER_ROLE) {
        uint256 _ethRequired = _calculateETHRequiredForToken(_token);

        if (msg.value < _ethRequired) {
            revert InsufficientBalance();
        }

        _createTokenAndDepositRewards(_token);
    }

    function createMultipleTokensAndDepositRewards(
        LibRewards.RewardToken[] calldata _tokens
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
     * @param _to The address to send the assets to.
     * @param _amount The amounts to withdraw.
     */
    function withdrawAll(
        address _to,
        uint256 _amount
    ) external onlyRole(MANAGER_ROLE) {
        if (_to == address(0)) {
            revert AddressIsZero();
        }
        _transferEther(payable(_to), _amount);
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
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

    function getTokenDetails(
        uint256 tokenId
    )
        public
        view
        returns (
            string memory tokenUri,
            uint256 maxSupply,
            uint256[] memory rewardAmounts
        )
    {
        tokenUri = tokenRewards[tokenId].tokenUri;
        maxSupply = tokenRewards[tokenId].maxSupply;
        LibRewards.Reward[] memory rewards = tokenRewards[tokenId].rewards;

        rewardAmounts = new uint256[](rewards.length);

        for (uint256 i = 0; i < rewards.length; i++) {
            rewardAmounts[i] = rewards[i].rewardAmount;
        }
    }

    function mint(
        address to,
        bytes calldata data,
        bool isSoulbound
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        uint256[] memory _tokenIds = _verifyContractChainIdAndDecode(data);
        _mintAccessRewardTokenBatch(to, _tokenIds, 1, isSoulbound);
    }

    function mintById(
        address toAddress,
        uint256 _tokenId,
        uint256 _amount,
        bool isSoulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        _mintRewardAccessToken(toAddress, _tokenId, _amount, isSoulbound);
    }

    function batchMintById(
        address[] calldata toAddresses,
        uint256 _tokenId,
        uint256[] calldata _amounts,
        bool isSoulbound
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        if (toAddresses.length != _amounts.length) {
            revert InvalidLength();
        }

        for (uint256 i = 0; i < toAddresses.length; i++) {
            _mintRewardAccessToken(
                toAddresses[i],
                _tokenId,
                _amounts[i],
                isSoulbound
            );
        }
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    /*//////////////////////////////////////////////////////////////
                           PRIVATE-FUNCTIONS
    //////////////////////////////////////////////////////////////*/
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

    function _validateTokenInputs(
        LibRewards.RewardToken calldata _token
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
    }

    function _calculateETHRequiredForToken(
        LibRewards.RewardToken calldata _token
    ) private pure returns (uint256) {
        uint256 totalETHRequired;
        for (uint256 i = 0; i < _token.rewards.length; i++) {
            LibRewards.Reward memory reward = _token.rewards[i];
            totalETHRequired += reward.rewardAmount;
        }
        return totalETHRequired * _token.maxSupply;
    }

    function _createTokenAndDepositRewards(
        LibRewards.RewardToken calldata _token
    ) private {
        // have to approve all the assets first
        // Validate token inputs
        _validateTokenInputs(_token);
        tokenRewards[_token.tokenId] = _token;
        tokenExists[_token.tokenId] = true;
        itemIds.push(_token.tokenId);
        rewardTokenContract.addNewToken(_token.tokenId);

        emit TokenAdded(_token.tokenId);
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
        LibRewards.RewardToken memory _rewardToken = tokenRewards[
            _rewardTokenId
        ];
        LibRewards.Reward[] memory rewards = _rewardToken.rewards;

        for (uint256 i = 0; i < rewards.length; i++) {
            LibRewards.Reward memory reward = rewards[i];
            _transferEther(payable(_to), reward.rewardAmount);
        }

        emit Claimed(_to, _rewardTokenId, 1);
    }

    function _mintAccessRewardTokenBatch(
        address to,
        uint256[] memory _tokenIds,
        uint256 _amount,
        bool soulbound
    ) private {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _mintRewardAccessToken(to, _tokenIds[i], _amount, soulbound);
        }
    }

    function _mintRewardAccessToken(
        address to,
        uint256 _tokenId,
        uint256 _amount,
        bool soulbound
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

        // mint reward token
        rewardTokenContract.adminMintId(to, _tokenId, _amount, soulbound);
        emit Minted(to, _tokenId, _amount, soulbound);
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
}
