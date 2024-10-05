// SPDX-License-Identifier: MIT
// To check the terms and conditions look for the file with hash QmW1YKgTAZmm92WUcPS9XzMAYXtFVUvDCNGNfEFJQJ1hBv on any IPFS node
pragma solidity ^0.8.24;

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



import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract FreeMint is ERC721URIStorage, ERC721Enumerable, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    string public baseTokenURI;
    mapping(uint256 => bool) public nftRevealed;
    bool public LOCKED_CONTRACT = false;
    mapping(address => bool) private addressesMinted;
    string private unrevealedURI;
    string private _contractURI = "https://achievo.mypinata.cloud/ipfs/QmPkeXk49oqBYckGeM5mzwNztVDGcsnCB7RwbCPKo5racj";
    mapping(address => bool) public whitelistSigners;
    bool public freeMintPaused = false;
    bool public freeQRMintPaused = false;

    event ContractLocked(bool locked);
    event ContractUnlocked(bool locked);
    event FreeMintPaused(bool paused);
    event FreeMintUnpaused(bool paused);
    event FreeQRMintPaused(bool paused);
    event FreeQRMintUnpaused(bool paused);
    event SignerAdded(address signer);
    event SignerRemoved(address signer);
    event FreeMinted(address indexed to);
    event NFTRevealed(uint256 indexed tokenId);

    uint256 private _tokenIdCounter;

    modifier noLocked() {
        require(LOCKED_CONTRACT == false, "OpenMintZk: Sorry, this contract is locked");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseTokenURI,
        string memory _unrevealedURI
    ) ERC721(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        setSigner(msg.sender);
        baseTokenURI = _baseTokenURI;
        unrevealedURI = _unrevealedURI;
    }

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    function setContractURI(string memory __contractURI) public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        _contractURI = __contractURI;
    }

    function pauseFreeMint() public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        freeMintPaused = true;
        emit FreeMintPaused(freeMintPaused);
    }

    function unpauseFreeMint() public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        freeMintPaused = false;
        emit FreeMintUnpaused(freeMintPaused);
    }

    function pauseFreeQRMint() public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        freeQRMintPaused = true;
        emit FreeQRMintPaused(freeQRMintPaused);
    }

    function unpauseFreeQRMint() public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        freeQRMintPaused = false;
        emit FreeQRMintUnpaused(freeQRMintPaused);
    }

    function setSigner(address _signer) public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        whitelistSigners[_signer] = true;
        emit SignerAdded(_signer);
    }

    function removeSigner(address signer) public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        whitelistSigners[signer] = false;
        emit SignerRemoved(signer);
    }

    function setUnrevealedURI(string memory _unrevealedURI) public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        unrevealedURI = _unrevealedURI;
    }

    function recoverSigner(uint256 nonce, bytes memory signature) public view returns (address) {
        bytes32 message = keccak256(abi.encodePacked(msg.sender, nonce));
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(message);
        address receivedAddress = ECDSA.recover(hash, signature);
        return receivedAddress;
    }

    function mint(address to) private {
        require(to != address(0), "OpenMintZk: mint to the zero address");
        require(!addressesMinted[to], "OpenMintZk: Sorry, This address already has a token");
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, unrevealedURI);
        addressesMinted[to] = true;
        _tokenIdCounter++;
        emit FreeMinted(to);
    }

    function batchMint(address[] memory to) public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        for (uint256 i = 0; i < to.length; i++) {
            mint(to[i]);
        }
    }

    function qrFreeMint(uint256 nonce, bytes memory signature) public nonReentrant noLocked {
        require(!freeQRMintPaused, "OpenMintZk: Free QR Mint is not available");
        address signer = recoverSigner(nonce, signature);
        require(whitelistSigners[signer], "OpenMintZk: Invalid signer");
        mint(msg.sender);
    }

    function safeMint(address to) public onlyRole(MINTER_ROLE) noLocked {
        mint(to);
    }

    function freeMint() public nonReentrant noLocked {
        require(!freeMintPaused, "OpenMintZk: Free Mint is not available");
        mint(msg.sender);
    }

    function reveal(uint256 tokenId, string memory tokenURL) public onlyRole(MINTER_ROLE) noLocked {
        require(_exists(tokenId), "OpenMintZk: URI set of nonexistent token");
        require(!nftRevealed[tokenId], "OpenMintZk: Token already revealed");
        _setTokenURI(tokenId, tokenURL);
        nftRevealed[tokenId] = true;
        emit NFTRevealed(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function batchSetTokenURI(
        uint256[] memory tokenIds,
        string[] memory tokenURIs
    ) public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        require(tokenIds.length == tokenURIs.length, "OpenMintZk: tokenIds and URIs length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_exists(tokenIds[i]), "OpenMintZk: URI set of nonexistent token");
            _setTokenURI(tokenIds[i], tokenURIs[i]);
        }
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseURI(string memory _baseTokenURI) public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        baseTokenURI = _baseTokenURI;
    }

    function lockContract() public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        require(LOCKED_CONTRACT == false, "OpenMintZk: Sorry, this contract is already locked");
        LOCKED_CONTRACT = true;
        emit ContractLocked(LOCKED_CONTRACT);
    }

    function unlockContract() public onlyRole(DEFAULT_ADMIN_ROLE) noLocked {
        require(LOCKED_CONTRACT == true, "OpenMintZk: Sorry, this contract is already unlocked");
        LOCKED_CONTRACT = false;
        emit ContractUnlocked(LOCKED_CONTRACT);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Function to check if a token exists
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
