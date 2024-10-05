// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @author omar@game7.io

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

// ====== External imports ======
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

//  ==========  Internal imports    ==========

import { RoyaltyPaymentsLogic } from "../../../ercs/extensions/RoyaltyPayments.sol";
import { BaseRouter, IRouter, IRouterState } from "../../../router/BaseRouter.sol";
import "../../../ercs/extensions/Multicall.sol";
import "../../ercs/extensions/Initializable.sol";
import "../../../ercs/extensions/ContractMetadata.sol";
import "../../../ercs/extensions/PlatformFee.sol";
import "../../../ercs/extensions/PermissionsEnumerable.sol";
import "../../security/ReentrancyGuardInit.sol";
import "../../ercs/extensions/ERC2771ContextUpgradeable.sol";

contract Marketplace is
    Initializable,
    Multicall,
    BaseRouter,
    ContractMetadata,
    PlatformFee,
    PermissionsEnumerable,
    ReentrancyGuardInit,
    ERC2771ContextUpgradeable,
    RoyaltyPaymentsLogic,
    ERC721Holder,
    ERC1155Holder
{
    /// @dev Only EXTENSION_ROLE holders can perform upgrades.
    bytes32 public constant EXTENSION_ROLE = keccak256("EXTENSION_ROLE");

    bytes32 private constant MODULE_TYPE = bytes32("Marketplace");
    uint256 private constant VERSION = 1;

    /// @dev The address of the native token wrapper contract.
    address private immutable nativeTokenWrapper;

    /*///////////////////////////////////////////////////////////////
                    Constructor + initializer logic
    //////////////////////////////////////////////////////////////*/

    constructor(
        Extension[] memory _extensions,
        address _royaltyEngineAddress,
        address _nativeTokenWrapper
    ) BaseRouter(_extensions) RoyaltyPaymentsLogic(_royaltyEngineAddress) {
        nativeTokenWrapper = _nativeTokenWrapper;
        _disableInitializers();
    }

    receive() external payable {
        assert(msg.sender == nativeTokenWrapper); // only accept ETH via fallback from the native token wrapper contract
    }

    /// @dev Initializes the contract, like a constructor.
    function initialize(
        address _defaultAdmin,
        string memory _contractURI,
        address[] memory _trustedForwarders,
        address _platformFeeRecipient,
        uint16 _platformFeeBps
    ) external initializer {
        // Initialize BaseRouter
        __BaseRouter_init();

        // Initialize inherited contracts, most base-like -> most derived.
        __ReentrancyGuard_init();
        __ERC2771Context_init(_trustedForwarders);

        // Initialize this contract's state.
        _setupContractURI(_contractURI);
        _setupPlatformFeeInfo(_platformFeeRecipient, _platformFeeBps);

        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(EXTENSION_ROLE, _defaultAdmin);
        _grantRole(keccak256("MANAGER_ROLE"), _defaultAdmin);
        _grantRole(keccak256("LISTER_ROLE"), address(0));
        _grantRole(keccak256("ASSET_ROLE"), address(0));
        _grantRole(keccak256("MANAGER_ROLE"), address(0));
        _grantRole(EXTENSION_ROLE, _defaultAdmin);
        _setRoleAdmin(EXTENSION_ROLE, EXTENSION_ROLE);
    }

    /*///////////////////////////////////////////////////////////////
                        Generic contract logic
    //////////////////////////////////////////////////////////////*/

    /// @dev Returns the type of the contract.
    function contractType() external pure returns (bytes32) {
        return MODULE_TYPE;
    }

    /// @dev Returns the version of the contract.
    function contractVersion() external pure returns (uint8) {
        return uint8(VERSION);
    }

    /*///////////////////////////////////////////////////////////////
                        ERC 165 / 721 / 1155 logic
    //////////////////////////////////////////////////////////////*/

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165, ERC1155Holder) returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IRouter).interfaceId ||
            interfaceId == type(IRouterState).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /*///////////////////////////////////////////////////////////////
                        Overridable Permissions
    //////////////////////////////////////////////////////////////*/

    /// @dev Checks whether platform fee info can be set in the given execution context.
    function _canSetPlatformFeeInfo() internal view override returns (bool) {
        return _hasRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /// @dev Checks whether contract metadata can be set in the given execution context.
    function _canSetContractURI() internal view override returns (bool) {
        return _hasRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /// @dev Returns whether royalty engine address can be set in the given execution context.
    function _canSetRoyaltyEngine() internal view override returns (bool) {
        return _hasRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /// @dev Checks whether an account has a particular role.
    function _hasRole(bytes32 _role, address _account) internal view returns (bool) {
        PermissionsStorage.Data storage data = PermissionsStorage.data();
        return data._hasRole[_role][_account];
    }

    /// @dev Returns whether all relevant permission and other checks are met before any upgrade.
    function _isAuthorizedCallToUpgrade() internal view virtual override returns (bool) {
        return _hasRole(EXTENSION_ROLE, msg.sender);
    }

    function _msgSender()
        internal
        view
        override(ERC2771ContextUpgradeable, Permissions, Multicall)
        returns (address sender)
    {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData() internal view override(ERC2771ContextUpgradeable, Permissions) returns (bytes calldata) {
        return ERC2771ContextUpgradeable._msgData();
    }
}
