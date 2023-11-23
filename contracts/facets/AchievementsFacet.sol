// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibAchievements.sol";

contract AchievementFacet is ERC1155, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor(string memory _uri) ERC1155(_uri) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    event AchievementMinted(address indexed creator, uint256 indexed tokenId, bool soulbounded, address indexed userAddress);

    function mint(address _to, uint256 _id, uint256 _amount, bytes memory _data, bool _soulbound) external onlyRole(MINTER_ROLE) whenNotPaused {
        LibAchievements.AchievementsStorage storage astore = LibAchievements.achievementsStorage();
        _mint(_to, _id, _amount, _data);
        astore.tokenData[_id] = LibAchievements.TokenData({ owner: _to, soulbounded: _soulbound, blackListed: false });
        emit AchievementMinted(msg.sender, _id, _soulbound, _to);
    }

    function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) public virtual override whenNotPaused {
        LibAchievements.AchievementsStorage storage astore = LibAchievements.achievementsStorage();

        if (astore.tokenData[_id].soulbounded) {
            require(astore.tokenData[_id].owner == _from, "AchievementFacet: Cannot transfer soulbound token");
        }
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public virtual override whenNotPaused {
        LibAchievements.AchievementsStorage storage astore = LibAchievements.achievementsStorage();
        for (uint256 i = 0; i < _ids.length; ++i) {
            if (astore.tokenData[_ids[i]].soulbounded) {
                require(astore.tokenData[_ids[i]].owner == _from, "AchievementFacet: Cannot transfer soulbounded token");
            }
        }
        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function uri(string memory subPath, uint256 tokenId) public view returns (string memory) {
        return (string(abi.encodePacked(super.uri(tokenId), subPath, "/", Strings.toString(tokenId), ".json")));
    }
}
