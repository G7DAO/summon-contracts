import { ethers, upgrades } from 'hardhat';

/**
 * Deploy RewardsManager (one manager, many servers), beacon and RewardsFactory.
 *
 * 1. Deploy RewardsServer implementation (for beacon)
 * 2. Deploy RewardsManager (UUPS proxy), initialize with (dev, manager)
 * 3. initializeBeacons(rewardsServerImpl)
 * 4. Deploy RewardsFactory(manager), setBeacons, grant FACTORY_ROLE to factory on manager (required for deployServer to succeed)
 *
 * After this, anyone can call factory.deployServer(serverId) to create a server.
 *
 * Usage:
 *   pnpm hardhat run scripts/deployRewardsManager.ts --network hardhat
 *   pnpm hardhat run scripts/deployRewardsManager.ts --network sepolia
 */

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log('========================================');
    console.log('RewardsManager Deployment');
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

    // 2. Deploy RewardsManager (UUPS proxy)
    console.log('\n2. Deploying RewardsManager (UUPS proxy)...');
    const RewardsManager = await ethers.getContractFactory('RewardsManager');
    const manager = await upgrades.deployProxy(
        RewardsManager,
        [devWallet, managerWallet],
        { kind: 'uups', initializer: 'initialize' }
    );
    await manager.waitForDeployment();
    const managerAddress = await manager.getAddress();
    const managerImpl = await upgrades.erc1967.getImplementationAddress(managerAddress);
    console.log('   RewardsManager proxy:', managerAddress);
    console.log('   RewardsManager impl:', managerImpl);

    // 3. Initialize beacon
    console.log('\n3. Initializing rewards server beacon...');
    let tx = await manager.initializeBeacons(rewardsServerImplAddress);
    await tx.wait();
    console.log('   Beacon initialized.');

    // 4. Deploy RewardsFactory and wire to manager
    console.log('\n4. Deploying RewardsFactory...');
    const RewardsFactory = await ethers.getContractFactory('RewardsFactory');
    const factory = await RewardsFactory.deploy(managerAddress);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    tx = await factory.setBeacons(await manager.treasuryBeacon());
    await tx.wait();
    tx = await manager.grantRole(await manager.FACTORY_ROLE(), factoryAddress);
    await tx.wait();
    console.log('   RewardsFactory:', factoryAddress);

    console.log('\n========================================');
    console.log('Deployment complete.');
    console.log('========================================');
    console.log('RewardsManager:', managerAddress);
    console.log('RewardsFactory:', factoryAddress);
    console.log('To create a server: factory.deployServer(serverId)');
    console.log('  e.g. serverId = ethers.keccak256(ethers.toUtf8Bytes("my-server"))');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
