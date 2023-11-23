// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IOpenMint is IERC721 {
    event ContractLocked(bool locked);
    event ContractUnlocked(bool locked);
    event FreeMintPaused(bool paused);
    event FreeMintUnpaused(bool paused);
    event FreeQRMintPaused(bool paused);
    event FreeQRMintUnpaused(bool paused);
    event SignerAdded(address signer);
    event SignerRemoved(address signer);
    event FreeMint(address indexed to);
    event NFTRevealed(uint256 indexed tokenId);

    function contractURI() external view returns (string memory);
    function setContractURI(string memory __contractURI) external;
    function pauseFreeMint() external;
    function unpauseFreeMint() external;
    function pauseFreeQRMint() external;
    function unpauseFreeQRMint() external;
    function setSigner(address _signer) external;
    function removeSigner(address signer) external;
    function setUnrevealedURI(string memory _unrevealedURI) external;
    function recoverSigner(uint256 nonce, bytes memory signature) external view returns (address);
    function batchMint(address[] memory to) external;
    function qrFreeMint(uint256 nonce, bytes memory signature) external;
    function safeMint(address to) external;
    function freeMint() external;
    function reveal(uint256 tokenId, string memory tokenURL) external;
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function batchSetTokenURI(uint256[] memory tokenIds, string[] memory tokenURIs) external;
    function setBaseURI(string memory _baseTokenURI) external;
    function lockContract() external;
    function unlockContract() external;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}