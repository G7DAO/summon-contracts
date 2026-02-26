import { ethers, upgrades } from 'hardhat';

/**
 * Deploy RewardsRouter (one router, many servers).
 *
 * 1. Deploy RewardsServer implementation
 * 2. Deploy RewardsRouter (UUPS proxy), initialize(devWallet, serverImplementation)
 *    — Router deploys UpgradeableBeacon(implementation, devWallet) internally; devWallet owns the beacon.
 *
 * After this, an account with MANAGER_ROLE (granted to devWallet) can call router.deployServer(serverId, serverAdmin) to create a server.
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

    // 1. Deploy RewardsServer implementation (router will create beacon pointing to this)
    console.log('1. Deploying RewardsServer implementation...');
    const RewardsServer = await ethers.getContractFactory('RewardsServer');
    const rewardsServerImpl = await RewardsServer.deploy();
    await rewardsServerImpl.waitForDeployment();
    const rewardsServerImplAddress = await rewardsServerImpl.getAddress();
    console.log('   RewardsServer impl:', rewardsServerImplAddress);

    // 2. Deploy RewardsRouter (UUPS proxy); initialize deploys UpgradeableBeacon(impl, devWallet)
    console.log('\n2. Deploying RewardsRouter (UUPS proxy)...');
    const RewardsRouter = await ethers.getContractFactory('RewardsRouter');
    const router = await upgrades.deployProxy(RewardsRouter, [devWallet, rewardsServerImplAddress], {
        kind: 'uups',
        initializer: 'initialize',
    });
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    const routerImpl = await upgrades.erc1967.getImplementationAddress(routerAddress);
    console.log('   RewardsRouter proxy:', routerAddress);
    console.log('   RewardsRouter impl:', routerImpl);
    console.log('   serverBeacon (owner: dev):', await router.serverBeacon());

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
