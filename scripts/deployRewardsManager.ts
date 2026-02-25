import { ethers, upgrades } from 'hardhat';

/**
 * Deploy RewardsRouter (one router, many servers) and beacon.
 *
 * 1. Deploy RewardsServer implementation (for beacon)
 * 2. Deploy RewardsRouter (UUPS proxy), initialize with (dev, manager)
 * 3. initializeBeacons(rewardsServerImpl)
 *
 * After this, an account with MANAGER_ROLE can call router.deployServer(serverId, serverAdmin) to create a server.
 *
 * Usage:
 *   pnpm hardhat run scripts/deployRewardsManager.ts --network hardhat
 *   pnpm hardhat run scripts/deployRewardsManager.ts --network sepolia
 */

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log('========================================');
    console.log('RewardsRouter Deployment');
    console.log('========================================');
    console.log('Deployer:', deployer.address);
    console.log('========================================\n');

    const devWallet = deployer.address;
    const managerWallet = deployer.address;

    // 1. Deploy RewardsServer implementation (no proxy - used as beacon implementation)
    console.log('1. Deploying RewardsServer implementation...');
    const RewardsServer = await ethers.getContractFactory('RewardsServer');
    const rewardsServerImpl = await RewardsServer.deploy();
    await rewardsServerImpl.waitForDeployment();
    const rewardsServerImplAddress = await rewardsServerImpl.getAddress();
    console.log('   RewardsServer impl:', rewardsServerImplAddress);

    // 2. Deploy RewardsRouter (UUPS proxy)
    console.log('\n2. Deploying RewardsRouter (UUPS proxy)...');
    const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
    const router = await upgrades.deployProxy(
        RewardsRouter,
        [devWallet, managerWallet],
        { kind: 'uups', initializer: 'initialize' }
    );
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    const routerImpl = await upgrades.erc1967.getImplementationAddress(routerAddress);
    console.log('   RewardsRouter proxy:', routerAddress);
    console.log('   RewardsRouter impl:', routerImpl);

    // 3. Initialize beacon
    console.log('\n3. Initializing rewards server beacon...');
    const tx = await router.initializeBeacons(rewardsServerImplAddress);
    await tx.wait();
    console.log('   Beacon initialized.');

    console.log('\n========================================');
    console.log('Deployment complete.');
    console.log('========================================');
    console.log('RewardsRouter:', routerAddress);
    console.log('To create a server: router.deployServer(serverId, serverAdmin)');
    console.log('  e.g. serverId = 1 (uint8), serverAdmin = address with SERVER_ADMIN_ROLE on the new server');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
