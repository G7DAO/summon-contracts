// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * Author: Omar <omar@game7.io>(https://github.com/ogarciarevett)
 * Co-Authors: Max <max@game7.io>(https://github.com/vasinl124)
 */

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

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ERCWhitelistSignature {
    mapping(address => bool) public whitelistSigners;

    event WhitelistSignerAdded(address indexed signer);
    event WhitelistSignerRemoved(address indexed signer);

    mapping(bytes => bool) private usedSignatures;

    function _addWhitelistSigner(address _signer) internal virtual {
        require(_signer != address(0), "ERCWhitelistSignature: signer is the zero address");
        whitelistSigners[_signer] = true;
        emit WhitelistSignerAdded(_signer);
    }

    function _removeWhitelistSigner(address _signer) internal virtual {
        require(_signer != address(0), "ERCWhitelistSignature: signer is the zero address");
        whitelistSigners[_signer] = false;
        emit WhitelistSignerRemoved(_signer);
    }

    function recoverAddress(address to, uint256 nonce, bytes calldata data, bytes calldata signature) internal pure virtual returns (address) {
        bytes32 message = keccak256(abi.encodePacked(to, data, nonce));
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(hash, signature);
        return signer;
    }

    function verifySignature(address to, uint256 nonce, bytes calldata data, bytes calldata signature) internal virtual returns (bool) {
        address signer = recoverAddress(to, nonce, data, signature);
        if (whitelistSigners[signer]) {
            usedSignatures[signature] = true;
            return true;
        } else {
            return false;
        }
    }
}
