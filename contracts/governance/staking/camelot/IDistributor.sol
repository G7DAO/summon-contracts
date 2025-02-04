// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface IDistributor {
    /// @dev The given leaf has already been claimed
    error AlreadyClaimed();

    /// @dev Contract is paused for claiming rewards
    error ContractIsPaused();

    /// @dev Failed to send native token
    error FailedToSendNative();

    /// @dev Array lengths do not match
    error InvalidLengths();

    /// @dev MerkleUpdater cannot be the zero address
    error InvalidMerkleUpdater();

    /// @dev Provided proof is invalid
    error InvalidProof();

    /// @dev msg.sender is not authorized to call this function
    error Unauthorized();

    /// @dev Emitted when pending rewards are claimed
    /// @param user Address of the user who earned the rewards
    /// @param pool Address of the pool that earned the user the rewards
    /// @param token Address of the token that was claimed
    /// @param amount Amount of token claimed
    /// @param accAmount Total accumulated claimed amount
    /// @param identifier Identifier of the incentives (ie: positionId, gamma pool address, etc)
    event Claimed(
        address indexed user,
        address indexed pool,
        address indexed token,
        uint256 amount,
        uint256 accAmount,
        bytes identifier
    );

    /// @dev Emitted when the distributor contract is paused
    event DistributorPaused();

    /// @dev Emitted when the merkle updater is modified
    /// @param old Address of the previous merkle updater
    /// @param merkleUpdater Address of the new merkle updater
    event MerkleUpdaterChanged(address old, address merkleUpdater);

    /// @dev Emitted when an authorized user recovers an ERC20 token
    /// @param to Address to send the tokens to
    /// @param token Address of the token to recover
    /// @param amount Amount of token to recover
    event RecoveredERC20(address indexed to, address indexed token, uint256 amount);

    /// @dev Emitted when the merkle root is updated
    /// @param root The new root
    event RootUpdated(bytes32 root);

    /// @dev Emitted when the distributor contract is unpaused
    event DistributorUnpaused();

    /// @notice The root for the current epoch
    function root() external view returns (bytes32);

    /// @notice Returns the address capable of updating merkle root
    function merkleUpdater() external view returns (address);

    /// @notice Returns the address of the wrapped version of the native token
    function wNative() external view returns (address);

    /// @notice Checks whether a given leaf has already been claimed
    /// @param user Address of the account to check rewards for
    /// @param pool Address of the pool that earned the rewards
    /// @param token Address of the token earned as rewards
    /// @param amount Total cumulative amount of rewards earned
    /// @param identifier Identifier of how rewards were earned
    function isHarvested(
        address user,
        address pool,
        address token,
        uint256 amount,
        bytes calldata identifier
    ) external returns (bool);

    /// @notice Claims rewards accrued by the user as incentives
    /// @param user Address of the user who earned the rewards
    /// @param pool Address of the pool that earned the rewards
    /// @param token Address of the token to be claimed
    /// @param amount Total cumulative amount of rewards earned
    /// @param proof Merkle proof to verify user can claim rewards
    /// @param identifier Identifier of the incentives (ie: positionId, gamma pool address, etc)
    function harvest(
        address user,
        address pool,
        address token,
        uint256 amount,
        bytes calldata identifier,
        bytes32[] calldata proof
    ) external;

    /// @notice Claims multiple rewards accrued by the user as incentives
    /// @param user Address of the user who earned the rewards
    /// @param pools List of addresses of the pools that earned the rewards
    /// @param tokens List of addresses of tokens to be claimed
    /// @param amounts List of total cumulative amount of rewards earned
    /// @param identifiers List of identifiers of incentives earned
    /// @param proofs List of Merkle proofs to verify user can claim rewards
    function multiHarvest(
        address user,
        address[] calldata pools,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes[] calldata identifiers,
        bytes32[][] calldata proofs
    ) external;

    /// @notice Updates the Merkle root
    /// @dev Only callable by the owner
    /// @param newRoot The new Merkle root
    function updateRoot(bytes32 newRoot) external;

    /// @notice Recovers ERC20 tokens accidentally sent to the contract
    /// @dev Only callable by the owner
    /// @param to Address receiving the ERC20 tokens
    /// @param token Address of the token to transfer
    /// @param amount Amount of tokens to transfer
    function recoverERC20(address to, address token, uint256 amount) external;

    /// @notice Pauses the protocol.
    /// @dev Only callable by the owner
    function pause() external;

    /// @notice Unpauses the protocol.
    /// @dev Only callable by the owner
    function unpause() external;

    /// @notice Updates the merkle updater
    /// @dev Only callable by the owner
    function updateMerkleUpdater(address updater) external;
}
