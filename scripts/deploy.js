async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy SneakerToken
    const SneakerToken = await ethers.getContractFactory("SneakerToken");
    const sneakerToken = await SneakerToken.deploy();
    await sneakerToken.waitForDeployment();
    console.log("SneakerToken deployed to:", await sneakerToken.getAddress());

    // Deploy SneakerMarketplace with 5% commission fee
    const commissionFee = 5;
    const SneakerMarketplace = await ethers.getContractFactory("SneakerMarketplace");
    const marketplace = await SneakerMarketplace.deploy(await sneakerToken.getAddress(), commissionFee);
    await marketplace.waitForDeployment();
    console.log("SneakerMarketplace deployed to:", await marketplace.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });