// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { IGelatoVRFConsumer } from "contracts/IGelatoVRFConsumer.sol";

/// @title GelatoVRFConsumerBase
/// @dev This contract handles domain separation between consecutive randomness requests
/// The contract has to be implemented by contracts willing to use the gelato VRF system.
/// This base contract enhances the GelatoVRFConsumer by introducing request IDs and
/// ensuring unique random values.
/// for different request IDs by hashing them with the random number provided by drand.
/// For security considerations, refer to the Gelato documentation.
abstract contract GelatoVRFConsumerBase is IGelatoVRFConsumer {
    uint256 private constant _PERIOD = 3;
    uint256 private constant _GENESIS = 1692803367;
    bool[] public requestPending;
    mapping(uint256 => bytes32) public requestedHash;

    /// @notice Returns the address of the dedicated msg.sender.
    /// @dev The operator can be found on the Gelato dashboard after a VRF is deployed.
    /// @return Address of the operator.
    function _operator() internal view virtual returns (address);

    /// @notice User logic to handle the random value received.
    /// @param randomness The random number generated by Gelato VRF.
    /// @param requestId The ID for the randomness request.
    /// @param extraData Additional data from the randomness request.
    function _fulfillRandomness(uint256 randomness, uint256 requestId, bytes memory extraData) internal virtual;

    /// @notice Requests randomness from the Gelato VRF.
    /// @dev The extraData parameter allows for additional data to be passed to
    /// the VRF, which is then forwarded to the callback. This is useful for
    /// request tracking purposes if requestId is not enough.
    /// @param extraData Additional data for the randomness request.
    /// @return requestId The ID for the randomness request.
    function _requestRandomness(bytes memory extraData) internal returns (uint256 requestId) {
        requestId = uint256(requestPending.length);
        requestPending.push();
        requestPending[requestId] = true;

        bytes memory data = abi.encode(requestId, extraData);
        uint256 round = _round();

        bytes memory dataWithRound = abi.encode(round, data);
        bytes32 requestHash = keccak256(dataWithRound);

        requestedHash[requestId] = requestHash;

        emit RequestedRandomness(round, data);
    }

    /// @notice Callback function used by Gelato VRF to return the random number.
    /// The randomness is derived by hashing the provided randomness with the request ID.
    /// @param randomness The random number generated by Gelato VRF.
    /// @param dataWithRound Additional data provided by Gelato VRF containing request details.
    function fulfillRandomness(uint256 randomness, bytes calldata dataWithRound) external {
        require(msg.sender == _operator(), "only operator");

        (, bytes memory data) = abi.decode(dataWithRound, (uint256, bytes));
        (uint256 requestId, bytes memory extraData) = abi.decode(data, (uint256, bytes));

        bytes32 requestHash = keccak256(dataWithRound);
        bool isValidRequestHash = requestHash == requestedHash[requestId];

        require(requestPending[requestId], "request fulfilled or missing");

        if (isValidRequestHash) {
            randomness = uint(keccak256(abi.encode(randomness, address(this), block.chainid, requestId)));

            _fulfillRandomness(randomness, requestId, extraData);
            requestPending[requestId] = false;
        }
    }

    /// @notice Computes and returns the round number of drand to request randomness from.
    function _round() private view returns (uint256 round) {
        // solhint-disable-next-line not-rely-on-time
        uint256 elapsedFromGenesis = block.timestamp - _GENESIS;
        uint256 currentRound = (elapsedFromGenesis / _PERIOD) + 1;

        round = block.chainid == 1 ? currentRound + 4 : currentRound + 1;
    }
}
