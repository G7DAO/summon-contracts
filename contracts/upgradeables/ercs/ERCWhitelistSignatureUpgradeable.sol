// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

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

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ERCWhitelistSignatureUpgradeable is Initializable {
    mapping(address => bool) public whitelistSigners;
    mapping(bytes => bool) private usedSignatures;

    event WhitelistSignerAdded(address indexed signer);
    event WhitelistSignerRemoved(address indexed signer);

    modifier signatureCheck(
        address wallet,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) {
        if (!_verifySignature(wallet, nonce, data, signature)) {
            revert("InvalidSignature");
        }
        _;
    }

    function __ERCWhitelistSignatureUpgradeable_init() internal onlyInitializing {}

    function _addWhitelistSigner(address _signer) internal virtual {
        require(_signer != address(0), "ERCWhitelistSignature: signer is the zero address");
        require(!whitelistSigners[_signer], "ERCWhitelistSignature: signer is already in the whitelist");
        whitelistSigners[_signer] = true;
        emit WhitelistSignerAdded(_signer);
    }

    function _removeWhitelistSigner(address _signer) internal virtual {
        require(_signer != address(0), "ERCWhitelistSignature: signer is the zero address");
        require(whitelistSigners[_signer], "ERCWhitelistSignature: signer is not in the whitelist");
        whitelistSigners[_signer] = false;
        emit WhitelistSignerRemoved(_signer);
    }

    function _recoverAddress(
        address to,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) internal pure virtual returns (address) {
        bytes32 message = keccak256(abi.encodePacked(to, data, nonce));
        bytes32 hash = ECDSAUpgradeable.toEthSignedMessageHash(message);
        address signer = ECDSAUpgradeable.recover(hash, signature);
        return signer;
    }

    function _verifySignature(
        address to,
        uint256 nonce,
        bytes calldata data,
        bytes calldata signature
    ) internal virtual returns (bool) {
        if (usedSignatures[signature]) revert("AlreadyUsedSignature");

        address signer = _recoverAddress(to, nonce, data, signature);
        if (whitelistSigners[signer]) {
            usedSignatures[signature] = true;
            return true;
        } else {
            return false;
        }
    }

    function _decodeStringData(bytes calldata _data) internal virtual returns (string[] memory) {
        string[] memory values = abi.decode(_data, (string[]));
        return values;
    }

    function _decodeUintData(bytes calldata _data) internal virtual returns (uint256[] memory) {
        uint256[] memory values = abi.decode(_data, (uint256[]));
        return values;
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[48] private __gap;
}
