import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IERC20Decimals is IERC20 {
    function decimals() external view returns (uint8);
}