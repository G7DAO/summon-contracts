// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// @author summon Team - https://summon.xyz
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
import { ERC1155Burnable } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import { ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import { Achievo1155Soulbound } from "../ercs/extensions/Achievo1155Soulbound.sol";
import { ERCWhitelistSignature } from "../ercs/ERCWhitelistSignature.sol";
import { LibGameSummary } from "../libraries/LibGameSummary.sol";

error AddressIsZero();
error InvalidInput();

contract GameSummary is
    ERC1155Burnable,
    ERC1155Supply,
    Achievo1155Soulbound,
    ERCWhitelistSignature,
    AccessControl,
    Pausable,
    ReentrancyGuard,
    Initializable
{
    event BaseURIChanged(string indexed uri);
    event ContractURIChanged(string indexed uri);
    event CompoundURIChanged(string indexed uri);
    event CompoundURIEnabledChanged(bool enabled);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant DEV_CONFIG_ROLE = keccak256("DEV_CONFIG_ROLE");

    string public contractURI;
    string private baseURI;
    string public compoundURI;

    bool public compoundURIEnabled;
    bool public isOneTokenPerWallet = true;

    string public name;
    string public symbol;
    using Strings for uint256;

    uint256 public MAX_PER_MINT;

    mapping(uint256 => bool) private tokenExists;

    mapping(uint256 => uint256) public storeIds; // tokenId => storeIds
    mapping(uint256 => uint256) public playerIds; // tokenId => playerIds
    mapping(uint256 => uint256) public gameIds; // tokenId => gameIds

    mapping(uint256 => bool) public isTokenMintPaused; // tokenId => bool - default is false

    uint256[] public itemIds;

    mapping(address => mapping(uint256 => bool)) private tokenIdProcessed;

    event Minted(address indexed to, uint256[] tokenIds, uint256 amount, bool soulbound);
    event MintedId(address indexed to, uint256 indexed tokenId, uint256 amount, bool soulbound);
    event TokenAdded(uint256 indexed tokenId);

    modifier maxPerMintCheck(uint256 amount) {
        if (amount > MAX_PER_MINT) {
            revert("ExceedMaxMint");
        }
        _;
    }

    constructor(address devWallet) ERC1155("") {
        if (devWallet == address(0)) {
            revert AddressIsZero();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, devWallet);
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _initBaseURI,
        string memory _contractURI,
        string memory _compoundURI,
        uint256 _maxPerMint,
        bool _isPaused,
        address devWallet
    ) external initializer onlyRole(DEFAULT_ADMIN_ROLE) {
        if (devWallet == address(0)) {
            revert AddressIsZero();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, devWallet);
        _grantRole(DEV_CONFIG_ROLE, devWallet);
        _grantRole(MINTER_ROLE, devWallet);
        _grantRole(MANAGER_ROLE, devWallet);
        _addWhitelistSigner(devWallet);

        name = _name;
        symbol = _symbol;
        baseURI = _initBaseURI;
        contractURI = _contractURI;
        MAX_PER_MINT = _maxPerMint;

        compoundURIEnabled = true;
        compoundURI = _compoundURI;

        if (_isPaused) _pause();
    }

    function getAllItems() public view returns (LibGameSummary.GameSummaryReturn[] memory) {
        uint256 totalTokens = itemIds.length;
        LibGameSummary.GameSummaryReturn[] memory GameSummaryReturns = new LibGameSummary.GameSummaryReturn[](
            totalTokens
        );

        uint index;
        for (uint i = 0; i < totalTokens; i++) {
            uint256 tokenId = itemIds[i];
            uint256 amount = balanceOf(_msgSender(), tokenId);

            if (amount > 0) {
                LibGameSummary.GameSummaryReturn memory GameSummaryReturn = LibGameSummary.GameSummaryReturn({
                    tokenId: tokenId,
                    tokenUri: uri(tokenId),
                    storeId: storeIds[tokenId],
                    playerId: playerIds[tokenId],
                    gameId: gameIds[tokenId],
                    amount: amount
                });
                GameSummaryReturns[index] = GameSummaryReturn;
                index++;
            }
        }

        // truncate the array
        LibGameSummary.GameSummaryReturn[] memory returnsTruncated = new LibGameSummary.GameSummaryReturn[](index);
        for (uint i = 0; i < index; i++) {
            returnsTruncated[i] = GameSummaryReturns[i];
        }

        return returnsTruncated;
    }

    function getAllItemsAdmin(
        address _owner
    ) public view onlyRole(MINTER_ROLE) returns (LibGameSummary.GameSummaryReturn[] memory) {
        uint256 totalTokens = itemIds.length;
        LibGameSummary.GameSummaryReturn[] memory GameSummaryReturns = new LibGameSummary.GameSummaryReturn[](
            totalTokens
        );

        uint index;
        for (uint i = 0; i < totalTokens; i++) {
            uint256 tokenId = itemIds[i];
            uint256 amount = balanceOf(_owner, tokenId);

            LibGameSummary.GameSummaryReturn memory GameSummaryReturn = LibGameSummary.GameSummaryReturn({
                tokenId: tokenId,
                tokenUri: uri(tokenId),
                storeId: storeIds[tokenId],
                playerId: playerIds[tokenId],
                gameId: gameIds[tokenId],
                amount: amount
            });
            GameSummaryReturns[index] = GameSummaryReturn;
            index++;
        }

        // truncate the array
        LibGameSummary.GameSummaryReturn[] memory returnsTruncated = new LibGameSummary.GameSummaryReturn[](index);
        for (uint i = 0; i < index; i++) {
            returnsTruncated[i] = GameSummaryReturns[i];
        }

        return returnsTruncated;
    }

    function isTokenExist(uint256 _tokenId) public view returns (bool) {
        if (!tokenExists[_tokenId]) {
            return false;
        }
        return true;
    }

    function _verifyContractChainIdAndDecode(
        bytes calldata data
    ) private view returns (uint256[] memory, uint256[] memory, uint256[] memory) {
        uint256 currentChainId = getChainID();
        (
            address contractAddress,
            uint256 chainId,
            uint256[] memory _storeIds,
            uint256[] memory _playerIds,
            uint256[] memory _gameIds
        ) = _decodeData(data);

        if (chainId != currentChainId || contractAddress != address(this)) {
            revert InvalidInput();
        }
        return (_storeIds, _playerIds, _gameIds);
    }

    function decodeData(
        bytes calldata _data
    )
        public
        view
        onlyRole(DEV_CONFIG_ROLE)
        returns (address, uint256, uint256[] memory, uint256[] memory, uint256[] memory)
    {
        return _decodeData(_data);
    }

    function _decodeData(
        bytes calldata _data
    ) private pure returns (address, uint256, uint256[] memory, uint256[] memory, uint256[] memory) {
        (
            address contractAddress,
            uint256 chainId,
            uint256[] memory _storeIds,
            uint256[] memory _playerIds,
            uint256[] memory _gameIds
        ) = abi.decode(_data, (address, uint256, uint256[], uint256[], uint256[]));
        return (contractAddress, chainId, _storeIds, _playerIds, _gameIds);
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function getTokenId(uint256 storeId, uint256 playerId, uint256 gameId) public pure returns (uint256) {
        uint256 tokenId = uint256(keccak256(abi.encode(storeId, playerId, gameId)));
        return tokenId;
    }

    function _addNewToken(LibGameSummary.GameSummaryCreate memory _token) internal {
        tokenExists[_token.tokenId] = true;

        storeIds[_token.tokenId] = _token.storeId;
        playerIds[_token.tokenId] = _token.playerId;
        gameIds[_token.tokenId] = _token.gameId;

        itemIds.push(_token.tokenId);
        emit TokenAdded(_token.tokenId);
    }

    function updateTokenMintPaused(uint256 _tokenId, bool _isTokenMintPaused) public onlyRole(MANAGER_ROLE) {
        isTokenMintPaused[_tokenId] = _isTokenMintPaused;
    }

    function _mintBatch(
        address to,
        uint256[] memory _storeIds,
        uint256[] memory _playerIds,
        uint256[] memory _gameIds,
        uint256 amount,
        bool soulbound
    ) private {
        uint256[] memory _tokenIds = new uint256[](_storeIds.length);
        for (uint256 i = 0; i < _storeIds.length; i++) {
            uint256 _id = _internalMint(to, _storeIds[i], _playerIds[i], _gameIds[i], amount, soulbound);
            _tokenIds[i] = _id;
        }
        emit Minted(to, _tokenIds, amount, soulbound);
    }

    function _internalMint(
        address to,
        uint256 _storeId,
        uint256 _playerId,
        uint256 _gameId,
        uint256 amount,
        bool soulbound
    ) private returns (uint256) {
        uint256 _id = getTokenId(_storeId, _playerId, _gameId);

        if (isOneTokenPerWallet && balanceOf(to, _id) > 0) {
            revert("AlreadyMinted");
        }

        if (isTokenMintPaused[_id]) {
            revert("TokenMintPaused");
        }

        if (!isTokenExist(_id)) {
            LibGameSummary.GameSummaryCreate memory gameSummaryCreate = LibGameSummary.GameSummaryCreate({
                tokenId: _id,
                tokenUri: "",
                storeId: _storeId,
                playerId: _playerId,
                gameId: _gameId
            });
            _addNewToken(gameSummaryCreate);
        }

        if (soulbound) {
            _soulbound(to, _id, amount);
        }

        _mint(to, _id, amount, "");
        return _id;
    }

    function mint(
        bytes calldata data,
        uint256 amount,
        bool soulbound,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant signatureCheck(_msgSender(), nonce, data, signature) maxPerMintCheck(amount) whenNotPaused {
        (
            uint256[] memory _storeIds,
            uint256[] memory _playerIds,
            uint256[] memory _gameIds
        ) = _verifyContractChainIdAndDecode(data);
        _mintBatch(_msgSender(), _storeIds, _playerIds, _gameIds, amount, soulbound);
    }

    function adminMint(address to, bytes calldata data, bool soulbound) external onlyRole(MINTER_ROLE) whenNotPaused {
        (
            uint256[] memory _storeIds,
            uint256[] memory _playerIds,
            uint256[] memory _gameIds
        ) = _verifyContractChainIdAndDecode(data);
        _mintBatch(to, _storeIds, _playerIds, _gameIds, 1, soulbound);
    }

    function adminMintId(
        address to,
        uint256 _storeId,
        uint256 _playerId,
        uint256 _gameId,
        uint256 amount,
        bool soulbound
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        uint256 _id = _internalMint(to, _storeId, _playerId, _gameId, amount, soulbound);
        emit MintedId(to, _id, amount, soulbound);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
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
        if (!isTokenExist(tokenId)) {
            revert("TokenNotExist");
        }

        if (compoundURIEnabled) {
            // "{compoundURI}/0x1234567890123456789012345678901234567890/{tokenId}";
            return
                string(
                    abi.encodePacked(
                        compoundURI,
                        "/",
                        Strings.toHexString(uint160(address(this)), 20),
                        "/",
                        Strings.toString(storeIds[tokenId]),
                        "-",
                        Strings.toString(playerIds[tokenId]),
                        "-",
                        Strings.toString(gameIds[tokenId])
                    )
                );
        }

        return string(abi.encodePacked(baseURI, "/", tokenId.toString()));
    }

    function setBaseUri(string memory _uri) public onlyRole(DEV_CONFIG_ROLE) {
        baseURI = _uri;
        emit BaseURIChanged(baseURI);
    }

    function setCompoundURIEnabled(bool _compoundURIEnabled) public onlyRole(DEV_CONFIG_ROLE) {
        if (_compoundURIEnabled == compoundURIEnabled) {
            revert InvalidInput();
        }

        compoundURIEnabled = _compoundURIEnabled;
        emit CompoundURIEnabledChanged(_compoundURIEnabled);
    }

    function setCompoundURI(string memory _compoundURI) public onlyRole(DEV_CONFIG_ROLE) {
        compoundURI = _compoundURI;
        emit CompoundURIChanged(_compoundURI);
    }

    function setContractURI(string memory _contractURI) public onlyRole(DEV_CONFIG_ROLE) {
        contractURI = _contractURI;
        emit ContractURIChanged(_contractURI);
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

    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
