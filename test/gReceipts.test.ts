import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { GReceipts, GUnits, MockERC20 } from 'typechain-types';

describe('GReceipts', function () {
  const DEFAULT_RECEIPT_ID = 1;
  async function deployFixtures() {
    const [devWallet, minter, user1, user2, other] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory('MockERC20');
    const mockToken = await MockToken.deploy('Mock Token', 'MTK');
    await mockToken.waitForDeployment();

    // Deploy GUnits contract
    const GUnitsFactory = await ethers.getContractFactory('GUnits');
    const gUnitsProxy = await upgrades.deployProxy(
      GUnitsFactory,
      [await mockToken.getAddress(), false, devWallet.address],
      { initializer: 'initialize' }
    );
    await gUnitsProxy.waitForDeployment();
    const gUnits = await ethers.getContractAt('GUnits', await gUnitsProxy.getAddress());

    // Deploy GReceipts contract
    const GReceiptsFactory = await ethers.getContractFactory('GReceipts');
    const gReceiptsProxy = await upgrades.deployProxy(
      GReceiptsFactory,
      [await gUnits.getAddress(), await mockToken.getAddress(), false, devWallet.address],
      { initializer: 'initialize' }
    );
    await gReceiptsProxy.waitForDeployment();
    const gReceipts = await ethers.getContractAt('GReceipts', await gReceiptsProxy.getAddress());

    // Grant MINTER_ROLE to minter
    const MINTER_ROLE = await gReceipts.MINTER_ROLE();
    await gReceipts.connect(devWallet).grantRole(MINTER_ROLE, minter.address);

    // Grant THIRD_PARTY_ROLE to GReceipts on GUnits for adminDeposit
    const THIRD_PARTY_ROLE = await gUnits.THIRD_PARTY_ROLE();
    await gUnits.connect(devWallet).grantRole(THIRD_PARTY_ROLE, gReceipts.target);

    // Mint tokens to minter
    await mockToken.mint(minter.address, ethers.parseEther('1000'));
    await mockToken.mint(user1.address, ethers.parseEther('1000'));

    // Set GUnits exchange rate to 1:1 for simplicity
    await gUnits.connect(devWallet).setExchangeRate(1, 1);

    return { gReceipts, gUnits, mockToken, devWallet, minter, user1, user2, other };
  }

  describe('Deployment & Initialization', function () {
    it('Should deploy and initialize correctly', async function () {
      const { gReceipts, gUnits, mockToken, devWallet } = await loadFixture(deployFixtures);
      expect(await gReceipts.gUnits()).to.equal(await gUnits.getAddress());
      expect(await gReceipts.paymentToken()).to.equal(await mockToken.getAddress());
      expect(await gReceipts.hasRole(await gReceipts.DEFAULT_ADMIN_ROLE(), devWallet.address)).to.be.true;
    });
    it('Should revert if initialized with zero addresses', async function () {
      const GReceiptsFactory = await ethers.getContractFactory('GReceipts');
      await expect(
        upgrades.deployProxy(GReceiptsFactory, [ethers.ZeroAddress, ethers.ZeroAddress, false, ethers.ZeroAddress], { initializer: 'initialize' })
      ).to.be.revertedWithCustomError(await GReceiptsFactory.deploy(), 'AddressIsZero');
    });
  });

  describe('Minting', function () {
    let mockToken: MockERC20;
    let gReceipts: GReceipts;
    let gUnits: GUnits;
    let minter: SignerWithAddress;
    let user1: SignerWithAddress;

    beforeEach(async function () {
      ({ gReceipts, gUnits, mockToken, minter, user1 } = await loadFixture(deployFixtures));
    });
    it('Should mint a soulbound receipt, transfer payment, and deposit to GUnits', async function () {
      const amount = ethers.parseEther('10');
      const currencyAmount = amount; // 1:1 exchange rate
      await mockToken.connect(minter).approve(gReceipts.target, currencyAmount);
      await expect(gReceipts.connect(minter).mint(user1.address, amount))
        .to.emit(gReceipts, 'TransferSingle')
        .withArgs(minter.address, ethers.ZeroAddress, user1.address, DEFAULT_RECEIPT_ID, amount)
        .and.to.emit(gReceipts, 'Soulbound').withArgs(user1.address, DEFAULT_RECEIPT_ID, amount);
      expect(await gReceipts.balanceOf(user1.address, DEFAULT_RECEIPT_ID)).to.equal(amount);
      expect(await gReceipts.soulboundBalance(user1.address, DEFAULT_RECEIPT_ID)).to.equal(amount);
      expect(await mockToken.balanceOf(minter.address)).to.equal(ethers.parseEther('990'));
      expect(await mockToken.balanceOf(gUnits.target)).to.equal(currencyAmount);
      // GUnits adminDeposit should credit user1
      expect(await gUnits.balanceOf(user1.address)).to.equal(amount);
    });
    it('Should revert if not MINTER_ROLE', async function () {
      await expect(gReceipts.connect(user1).mint(user1.address, 1)).to.be.revertedWithCustomError(gReceipts, 'AccessControlUnauthorizedAccount');
    });
    it('Should revert if payment token allowance is insufficient', async function () {
      await expect(gReceipts.connect(minter).mint(user1.address, 1)).to.be.revertedWithCustomError(mockToken, 'ERC20InsufficientAllowance');
    });
    it('Should revert if payment token balance is insufficient', async function () {
      await mockToken.connect(minter).approve(await gReceipts.getAddress(), ethers.parseEther('10000'));
      await expect(gReceipts.connect(minter).mint(user1.address, ethers.parseEther('10000'))).to.be.revertedWithCustomError(mockToken, 'ERC20InsufficientBalance');
    });
    it('Should revert if minting to zero address', async function () {
      await expect(gReceipts.connect(minter).mint(ethers.ZeroAddress, 1)).to.be.revertedWithCustomError(gReceipts, 'AddressIsZero');
    });
    it('Should revert if minting zero amount', async function () {
      await expect(gReceipts.connect(minter).mint(user1.address, 0)).to.be.revertedWithCustomError(gReceipts, 'InvalidAmount');
    });
  });

  describe('Pausing/Unpausing', function () {
    let gReceipts: GReceipts;
    let devWallet: SignerWithAddress;
    let minter: SignerWithAddress;
    let user1: SignerWithAddress;
    let mockToken: MockERC20;
    beforeEach(async function () {
      ({ gReceipts, devWallet, minter, user1, mockToken } = await loadFixture(deployFixtures));
    });
    it('Should allow only DEV_CONFIG_ROLE to pause and unpause', async function () {
      await expect(gReceipts.connect(minter).pause()).to.be.revertedWithCustomError(gReceipts, 'AccessControlUnauthorizedAccount');
      await gReceipts.connect(devWallet).pause();
      expect(await gReceipts.paused()).to.be.true;
      await expect(gReceipts.connect(minter).unpause()).to.be.revertedWithCustomError(gReceipts, 'AccessControlUnauthorizedAccount');
      await gReceipts.connect(devWallet).unpause();
      expect(await gReceipts.paused()).to.be.false;
    });
    it('Should block minting when paused', async function () {
      await gReceipts.connect(devWallet).pause();
      await mockToken.connect(minter).approve(gReceipts.target, 1);
      await expect(gReceipts.connect(minter).mint(user1.address, 1)).to.be.revertedWithCustomError(gReceipts, 'EnforcedPause');
    });
  });

  describe('Admin Updates', function () {
    let gReceipts: GReceipts;
    let devWallet: SignerWithAddress;
    let gUnits: GUnits;
    let mockToken: MockERC20;
    beforeEach(async function () {
      ({ gReceipts, devWallet, gUnits, mockToken } = await loadFixture(deployFixtures));
    });
    it('Should allow DEV_CONFIG_ROLE to update GUnits and payment token when paused', async function () {
      await gReceipts.connect(devWallet).pause();
      // Deploy new GUnits and payment token
      const GUnitsFactory = await ethers.getContractFactory('GUnits');
      const newGUnits = await upgrades.deployProxy(GUnitsFactory, [await mockToken.getAddress(), false, devWallet.address], { initializer: 'initialize' });
      const MockToken = await ethers.getContractFactory('MockERC20');
      const newToken = await MockToken.deploy('New Token', 'NTK');
      await newToken.waitForDeployment();
      await expect(gReceipts.connect(devWallet).setGUnits(await newGUnits.getAddress()))
        .to.emit(gReceipts, 'GUnitsSet').withArgs(await newGUnits.getAddress());
      await expect(gReceipts.connect(devWallet).setPaymentToken(await newToken.getAddress()))
        .to.emit(gReceipts, 'PaymentTokenSet').withArgs(await newToken.getAddress());
      expect(await gReceipts.gUnits()).to.equal(await newGUnits.getAddress());
      expect(await gReceipts.paymentToken()).to.equal(await newToken.getAddress());
    });
    it('Should revert if setting zero address', async function () {
      await gReceipts.connect(devWallet).pause();
      await expect(gReceipts.connect(devWallet).setGUnits(ethers.ZeroAddress)).to.be.revertedWithCustomError(gReceipts, 'AddressIsZero');
      await expect(gReceipts.connect(devWallet).setPaymentToken(ethers.ZeroAddress)).to.be.revertedWithCustomError(gReceipts, 'AddressIsZero');
    });
  });

  describe('Soulbound Enforcement', function () {
    let gReceipts: GReceipts;
    let minter: SignerWithAddress;
    let user1: SignerWithAddress;
    beforeEach(async function () {
      ({ gReceipts, minter, user1 } = await loadFixture(deployFixtures));
    });
    it('Should revert on safeTransferFrom', async function () {
      await expect(
        gReceipts.connect(minter).safeTransferFrom(minter.address, user1.address, 1, 1, '0x')
      ).to.be.revertedWithCustomError(gReceipts, 'SoulboundError');
    });
    it('Should revert on safeBatchTransferFrom', async function () {
      await expect(
        gReceipts.connect(minter).safeBatchTransferFrom(minter.address, user1.address, [1], [1], '0x')
      ).to.be.revertedWithCustomError(gReceipts, 'SoulboundError');
    });
  });

  describe('Edge Cases', function () {
    let gReceipts: GReceipts;
    let devWallet: SignerWithAddress;
    let gUnits: GUnits;
    let mockToken: MockERC20;
    let minter: SignerWithAddress;
    beforeEach(async function () {
      ({ gReceipts, devWallet, gUnits, mockToken, minter } = await loadFixture(deployFixtures));
    });
    it('Should enforce role restrictions on admin functions', async function () {
      await gReceipts.connect(devWallet).pause();
      await expect(gReceipts.connect(minter).setGUnits(await gUnits.getAddress())).to.be.revertedWithCustomError(gReceipts, 'AccessControlUnauthorizedAccount');
      await expect(gReceipts.connect(minter).setPaymentToken(await mockToken.getAddress())).to.be.revertedWithCustomError(gReceipts, 'AccessControlUnauthorizedAccount');
    });
  });
});
