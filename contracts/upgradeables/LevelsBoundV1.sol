// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract LevelsBoundV1 is Initializable, ERC1155Upgradeable, OwnableUpgradeable {
    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;

    mapping(address => uint256) public playerLevel;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC1155_init("");
        __Ownable_init();
    }

    function mintLevel(address account, uint256 level) private onlyOwner {
        // check the balance of the account before minting twice
        _mint(account, level, 1, "");

        playerLevel[account] = level;
    }

    function getCurrentLevel(address account) public view returns (uint256) {
        return playerLevel[account];
    }

    function levelUp(address account, uint256 newLevel) public onlyOwner {
        require(newLevel > 0, "New level must be greater than 0");
        // check if the user has the previous lvl token
        require(balanceOf(account, newLevel) == 0, "Player already has this level token");

        if (newLevel == 1) {
            mintLevel(account, newLevel);
            return;
        }

        uint oldLevel = newLevel - 1;

        // check if the user has the previous lvl token
        require(balanceOf(account, oldLevel) == 1, "Player does not have the previous level token");

        // check if the "lvl up" actually is a "lvl down"
        require(balanceOf(account, oldLevel) < newLevel, "Is not possible to do lvl down");

        // Burn the old token
        burnLevel(account, oldLevel);
        mintLevel(account, newLevel);
    }

    function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _amount, bytes memory _data) public virtual override {
        revert("You can't transfer this token");
        super.safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function safeBatchTransferFrom(address _from, address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) public virtual override {
        revert("You can't transfer this token");
        super.safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
    }

    function burnLevel(address account, uint256 tokenId) public onlyOwner {
        _burn(account, tokenId, 1);
    }

    function burn(uint256 tokenId, uint256 amount) public {
        _burn(msg.sender, tokenId, amount);
        playerLevel[msg.sender] = 0;
    }

    function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) public {
        _burnBatch(msg.sender, tokenIds, amounts);
        playerLevel[msg.sender] = 0;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
