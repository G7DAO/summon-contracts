// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { SIG_VALIDATION_SUCCESS, SIG_VALIDATION_FAILED } from "@account-abstraction/contracts/core/Helpers.sol";
import { IEntryPoint } from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import { IAccount } from "@account-abstraction/contracts/interfaces/IAccount.sol";
import { PackedUserOperation } from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

contract CitizenAccount is IAccount, Ownable {
    /*//////////////////////////////////////////////////////////////
                               STATE VARS
    //////////////////////////////////////////////////////////////*/
    IEntryPoint private immutable i_entryPoint;


    /*//////////////////////////////////////////////////////////////
                                ERRORS
   //////////////////////////////////////////////////////////////*/
    error InvalidSignature();
    error NotFromEntryPoint();
    error NotFromEntryPointOrOwner();
    error CallFailed(bytes);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier requireFromEntryPoint() {
        if(msg.sender != address(i_entryPoint)) {
            revert NotFromEntryPoint();
        }
        _;
    }

    modifier requireFromEntryPointOrOwner() {
        if(msg.sender != address(i_entryPoint) && msg.sender != owner()) {
            revert NotFromEntryPointOrOwner();
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                               FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    constructor(address entryPoint) Ownable(msg.sender) {
        i_entryPoint = IEntryPoint(entryPoint);
    }

    receive() external payable {}


    /*//////////////////////////////////////////////////////////////
                         INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    // EIP-191 version of the signed hash
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        view
        returns (uint256 validationData)
    {

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        address signer = ECDSA.recover(ethSignedMessageHash, userOp.signature);
        if(signer != owner()) {
            return SIG_VALIDATION_FAILED;
        }

        return SIG_VALIDATION_SUCCESS;
    }

    function _payPrefund(uint256 missingAccountFunds) internal {
        if(missingAccountFunds != 0) {
            (bool success, ) = payable(msg.sender).call{value: missingAccountFunds, gas: type(uint256).max}("");
            (success);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/
    function getEntryPoint() external view returns (address) {
        return address(i_entryPoint);
    }

    /*//////////////////////////////////////////////////////////////
                          EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function execute(address dest, uint256 value, bytes calldata functionData) external requireFromEntryPoint {
        (bool success,  bytes memory result) = dest.call{value: value}(functionData);
        if(!success) {
            revert CallFailed(result);
        }

    }

    // A signature is valid, if  its the minimal account owner
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
    external
    requireFromEntryPoint
    returns (uint256 validationData)
    {
        uint256 validationData = _validateSignature(userOp, userOpHash);
        _payPrefund(missingAccountFunds);
    }
}
