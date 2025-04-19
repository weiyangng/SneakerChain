const hre = require("hardhat");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryOperation(operation, retries = 3, delayMs = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Retrying operation... (${i + 1}/${retries})`);
            await delay(delayMs);
        }
    }
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy SneakerToken
    const sneakerToken = await retryOperation(async () => {
        const SneakerToken = await hre.ethers.getContractFactory("SneakerToken");
        const contract = await SneakerToken.deploy();
        await contract.waitForDeployment();
        return contract;
    });
    console.log("SneakerToken deployed to:", await sneakerToken.getAddress());

    // Add a delay before deploying the next contract
    await delay(2000);

    // Deploy SneakerMarketplace with 5% commission fee
    const commissionFee = 5;
    const marketplace = await retryOperation(async () => {
        const SneakerMarketplace = await hre.ethers.getContractFactory("SneakerMarketplace");
        const contract = await SneakerMarketplace.deploy(await sneakerToken.getAddress(), commissionFee);
        await contract.waitForDeployment();
        return contract;
    });
    console.log("SneakerMarketplace deployed to:", await marketplace.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error.message);
        console.error("Error details:", error);
        process.exit(1);
    });