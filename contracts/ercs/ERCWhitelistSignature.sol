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

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract ERCWhitelistSignature {
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

    function _addWhitelistSigner(address _signer) internal virtual {
        require(
            _signer != address(0),
            "ERCWhitelistSignature: signer is the zero address"
        );
        whitelistSigners[_signer] = true;
        emit WhitelistSignerAdded(_signer);
    }

    function _removeWhitelistSigner(address _signer) internal virtual {
        require(
            _signer != address(0),
            "ERCWhitelistSignature: signer is the zero address"
        );
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
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(hash, signature);
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

    function _decodeStringData(
        bytes calldata _data
    ) internal virtual returns (string[] memory) {
        string[] memory values = abi.decode(_data, (string[]));
        return values;
    }

    function _decodeUintData(
        bytes calldata _data
    ) internal virtual returns (uint256[] memory) {
        uint256[] memory values = abi.decode(_data, (uint256[]));
        return values;
    }
}
