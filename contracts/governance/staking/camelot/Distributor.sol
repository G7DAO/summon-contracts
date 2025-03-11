// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    MerkleProof
} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import { IDistributor } from "./IDistributor.sol";
import { IWeth } from "./IWeth.sol";

contract Distributor is IDistributor, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @inheritdoc IDistributor
    address public immutable wNative;

    /// @inheritdoc IDistributor
    bytes32 public root;

    /// @notice Mapping of whether a user has claimed their rewards
    mapping(address user => mapping(address pool => mapping(address token => mapping(bytes identifier => uint256 amount))))
        public claimed;

    /// @inheritdoc IDistributor
    address public merkleUpdater;

    /// @notice Whether the contract is paused or not
    bool public paused;

    /// @param _owner The owner of the contract
    /// @param _updater Address that can update the merkle root of the contract
    /// @param _wNative The address of the wrapped native token for the deployed chain
    constructor(
        address _owner,
        address _updater,
        address _wNative
    ) Ownable(_owner) {
        if (_updater == address(0)) revert InvalidMerkleUpdater();

        merkleUpdater = _updater;
        wNative = _wNative;
    }

    /// @inheritdoc IDistributor
    function harvest(
        address user,
        address pool,
        address token,
        uint256 amount,
        bytes calldata identifier
    ) external nonReentrant {
        _requireNotPaused();
        _harvest(user, pool, token, amount, identifier);
    }

    /// @inheritdoc IDistributor
    function multiHarvest(
        address user,
        address[] calldata pools,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes[] calldata identifiers
    ) external nonReentrant {
        _requireNotPaused();

        if (
            tokens.length == 0 ||
            tokens.length != pools.length ||
            tokens.length != amounts.length ||
            tokens.length != identifiers.length
        ) revert InvalidLengths();

        for (uint256 i; i < tokens.length; ) {
            _harvest(user, pools[i], tokens[i], amounts[i], identifiers[i]);

            unchecked {
                i++;
            }
        }
    }

    /// @inheritdoc IDistributor
    function isHarvested(
        address user,
        address pool,
        address token,
        uint256 amount,
        bytes calldata identifier
    ) public view returns (bool) {
        return claimed[user][pool][token][identifier] >= amount;
    }

    // @inheritdoc IDistributor
    function getUnclaimedAmount(
        address user,
        address pool,
        address token,
        uint256 amount,
        bytes calldata identifier
    ) public view returns (uint256) {
        uint256 claimedAmount = claimed[user][pool][token][identifier];
        return amount < claimedAmount ? 0 : amount - claimedAmount;
    }

    /// @inheritdoc IDistributor
    function updateRoot(bytes32 newRoot) external {
        _requireOnlyMerkleUpdater();

        root = newRoot;

        emit RootUpdated(newRoot);
    }

    /// @inheritdoc IDistributor
    function recoverERC20(address to, address token, uint256 amount) external {
        _requireOnlyOwner();

        IERC20(token).safeTransfer(to, amount);
        emit RecoveredERC20(to, token, amount);
    }

    /// @inheritdoc IDistributor
    function pause() external {
        _requireOnlyOwner();

        paused = true;

        emit DistributorPaused();
    }

    /// @inheritdoc IDistributor
    function unpause() external {
        _requireOnlyOwner();

        paused = false;

        emit DistributorUnpaused();
    }

    /// @inheritdoc IDistributor
    function updateMerkleUpdater(address updater) external {
        _requireOnlyOwner();

        if (updater == address(0)) revert InvalidMerkleUpdater();

        address old = merkleUpdater;
        merkleUpdater = updater;

        emit MerkleUpdaterChanged(old, merkleUpdater);
    }

    receive() external payable {}

    /// @dev Checks if contract is paused
    function _requireNotPaused() internal view {
        if (paused) revert ContractIsPaused();
    }

    /// @dev Checks if caller has operator rights
    function _requireOnlyOwner() internal view {
        if (msg.sender != owner()) revert Unauthorized();
    }

    /// @dev Checks if caller has updater rights
    function _requireOnlyMerkleUpdater() internal view {
        if (msg.sender != merkleUpdater) revert Unauthorized();
    }

    /// @dev Internal function to handle harvest of rewards
    function _harvest(
        address user,
        address pool,
        address token,
        uint256 amount,
        bytes calldata identifier
    ) internal {
        uint256 toSend = 1234;

        emit Claimed(user, pool, token, toSend, amount, identifier);
    }

    /// @dev Internal function to withdraw wrapped native into native
    function _unwrap(uint256 _amount) internal {
        IWeth(wNative).withdraw(_amount);
    }
}
