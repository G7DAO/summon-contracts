module.exports = {
    skipFiles: ['upgradeables/marketplace/direct-listings-addon/DirectListingsAddon.sol'],
    mocha: {
        grep: '@skipCoverage', // Use a tag like @skipCoverage in your test descriptions
        invert: true, // This will run tests not matching the grep expression
    },
};
