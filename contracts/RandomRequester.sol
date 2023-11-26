// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { GelatoVRFConsumerBase } from "./GelatoVRFConsumerBase.sol";

contract RandomRequester is GelatoVRFConsumerBase {
    uint256 public randomnessReceived;
    uint256 public secondParameter;
    bytes public _extraData;
    address public _operatorAddr;

    constructor(address operator) {
        GelatoVRFConsumerBase(operator);
        _operatorAddr = operator;
    }

    function _operator() internal view override returns (address) {
        return _operatorAddr;
    }

    function _fulfillRandomness(uint256 randomness, uint256 _secondParameter, bytes memory extraData) internal override {
        randomnessReceived = randomness;
        secondParameter = _secondParameter;
        _extraData = extraData;
    }

    function requestRandomness() external {
        _requestRandomness(abi.encode(msg.sender));
    }
}
