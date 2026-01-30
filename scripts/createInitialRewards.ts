import { ethers } from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Creating rewards with account:', deployer.address);

    // Configuration
    const REWARDS_ADDRESS = process.env.REWARDS_ADDRESS || '0x53b27dE8fb05A051d5CA601Eb71505C508789102';

    if (!REWARDS_ADDRESS) {
        console.error('Please set REWARDS_ADDRESS environment variable');
        process.exit(1);
    }

    const rewards = await ethers.getContractAt('Rewards', REWARDS_ADDRESS);

    // Addresses on Sepolia
    const addresses = {
        F1: ethers.getAddress('0x1a7a1879bE0C3fD48e033B2eEF40063bFE551731'),
        NewJeans: ethers.getAddress('0x4afF7E3F1191b4dEE2a0358417a750C1c6fF9b62'),
        Quince: ethers.getAddress('0x40813d715Ed741C0bA6848763c93aaF75fEA7F55'),
        KPOP: ethers.getAddress('0x049d3CC16a5521E1dE1922059d09FCDd719DC81c'),
        USDC: ethers.getAddress('0x3E3a445731d7881a3729A3898D532D5290733Eb5'),
    };

    // Reward Configuration
    const rewardsToCreate = [
        {
            name: 'F1 Reward',
            tokenId: 1,
            tokenUri: 'https://summon.xyz/rewards/1',
            maxSupply: 100,
            rewards: [
                {
                    rewardType: 3, // ERC1155
                    rewardAmount: 1,
                    rewardTokenAddress: addresses.F1,
                    rewardTokenIds: [],
                    rewardTokenId: 1,
                },
            ],
        },
        {
            name: 'New Jeans Reward',
            tokenId: 2,
            tokenUri: 'https://summon.xyz/rewards/2',
            maxSupply: 100,
            rewards: [
                {
                    rewardType: 3, // ERC1155
                    rewardAmount: 1,
                    rewardTokenAddress: addresses.NewJeans,
                    rewardTokenIds: [],
                    rewardTokenId: 1,
                },
            ],
        },
        {
            name: 'Quince Reward',
            tokenId: 3,
            tokenUri: 'https://summon.xyz/rewards/3',
            maxSupply: 100,
            rewards: [
                {
                    rewardType: 3, // ERC1155
                    rewardAmount: 1,
                    rewardTokenAddress: addresses.Quince,
                    rewardTokenIds: [],
                    rewardTokenId: 1,
                },
            ],
        },
        {
            name: 'KPOP Reward',
            tokenId: 4,
            tokenUri: 'https://summon.xyz/rewards/4',
            maxSupply: 100,
            rewards: [
                {
                    rewardType: 3, // ERC1155
                    rewardAmount: 1,
                    rewardTokenAddress: addresses.KPOP,
                    rewardTokenIds: [],
                    rewardTokenId: 1,
                },
            ],
        },
        {
            name: 'USDC Reward',
            tokenId: 5,
            tokenUri: 'https://summon.xyz/rewards/5',
            maxSupply: 100,
            rewards: [
                {
                    rewardType: 1, // ERC20
                    rewardAmount: ethers.parseUnits('1', 6), // 1 USDC
                    rewardTokenAddress: addresses.USDC,
                    rewardTokenIds: [],
                    rewardTokenId: 0,
                },
            ],
        },
    ];

    console.log(`\nCreating ${rewardsToCreate.length} reward bundles...`);

    for (const rewardConfig of rewardsToCreate) {
        console.log(`\nProcessing Reward Token ID: ${rewardConfig.tokenId} (${rewardConfig.name})`);

        // 1. Calculate required amounts for deposit
        let usdcRequired = 0n;
        let erc1155Required = 0n;
        let erc1155Address = '';
        let erc1155Id = 0;

        for (const r of rewardConfig.rewards) {
            if (r.rewardType === 1) {
                // ERC20
                usdcRequired += BigInt(r.rewardAmount) * BigInt(rewardConfig.maxSupply);
            } else if (r.rewardType === 3) {
                // ERC1155
                erc1155Required += BigInt(r.rewardAmount) * BigInt(rewardConfig.maxSupply);
                erc1155Address = r.rewardTokenAddress;
                erc1155Id = r.rewardTokenId;
            }
        }

        // 2. Approve and Deposit USDC
        if (usdcRequired > 0n) {
            console.log(`Required USDC: ${ethers.formatUnits(usdcRequired, 6)}`);
            const MockERC20 = await ethers.getContractAt(
                '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
                addresses.USDC
            );

            // Check allowance
            const allowance = await MockERC20.allowance(deployer.address, REWARDS_ADDRESS);
            if (allowance < usdcRequired) {
                console.log('Approving USDC...');
                await(await MockERC20.approve(REWARDS_ADDRESS, ethers.MaxUint256)).wait();
            }

            console.log('Depositing USDC to Treasury...');
            const txDeposit = await rewards.depositToTreasury(addresses.USDC, usdcRequired);
            await txDeposit.wait();
            console.log('USDC Deposited');
        }

        // 3. Transfer ERC1155 directly to Rewards contract
        if (erc1155Required > 0n && erc1155Address) {
            console.log(`Required ERC1155 (${erc1155Address}, ID ${erc1155Id}): ${erc1155Required}`);
            const MockERC1155 = await ethers.getContractAt('IERC1155', erc1155Address);

            // Check balance
            const balance = await MockERC1155.balanceOf(deployer.address, erc1155Id);
            if (balance < erc1155Required) {
                console.warn(
                    `WARNING: Insufficient balance for ${rewardConfig.name}. Have ${balance}, need ${erc1155Required}. Transaction might fail.`
                );
            }

            console.log('Transferring ERC1155 to Treasury...');
            const txTransfer = await MockERC1155.safeTransferFrom(
                deployer.address,
                REWARDS_ADDRESS,
                erc1155Id,
                erc1155Required,
                '0x'
            );
            await txTransfer.wait();
            console.log('ERC1155 Transferred');

            // Debug: Check balance of Rewards contract
            const rewardsBalance = await MockERC1155.balanceOf(REWARDS_ADDRESS, erc1155Id);
            console.log(`Rewards Contract Balance for ${erc1155Address} ID ${erc1155Id}: ${rewardsBalance}`);
        }

        /*         // 4. Create Reward Token
        console.log('Creating Reward Token...');
        try {
            // Check if token already exists to avoid revert
            const exists = await rewards.isTokenExist(rewardConfig.tokenId);
            if (exists) {
                console.log(`Reward Token ${rewardConfig.tokenId} already exists. Skipping...`);
                continue;
            }

            const tx = await rewards.createTokenAndDepositRewards(rewardConfig);
            await tx.wait();
            console.log(`Reward Token ${rewardConfig.tokenId} created successfully!`);
        } catch (e: any) {
            console.error(`Failed to create reward ${rewardConfig.tokenId}:`, e.message);
        } */
    }

    console.log('\nAll rewards processed!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
