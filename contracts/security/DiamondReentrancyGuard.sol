// SPDX-License-Identifier: MIT

/**
 * Authors: Omar Garcia <omar@game7.io>
 * GitHub: https://github.com/ogarciarevett
 */

pragma solidity ^0.8.17;
import "../libraries/LibReentrancyGuard.sol";

abstract contract DiamondReentrancyGuard {
  modifier diamondNonReentrant() {
    LibReentrancyGuard.ReentrancyGuardStorage storage rgs = LibReentrancyGuard.reentrancyGuardStorage();
    require(!rgs._entered, "LibReentrancyGuard: reentrant call!");
    rgs._entered = true;
    _;
    rgs._entered = false;
  }
}
