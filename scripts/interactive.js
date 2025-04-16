const hre = require("hardhat");
const readlineSync = require("readline-sync");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Using deployer account:", deployer.address);

    // Get contract addresses
    const tokenAddress = readlineSync.question("Enter the SneakerToken contract address: ");
    const marketplaceAddress = readlineSync.question("Enter the SneakerMarketplace contract address: ");

    // Attach to deployed contracts
    const SneakerToken = await hre.ethers.getContractFactory("SneakerToken");
    const sneakerToken = SneakerToken.attach(tokenAddress);

    const SneakerMarketplace = await hre.ethers.getContractFactory("SneakerMarketplace");
    const marketplace = SneakerMarketplace.attach(marketplaceAddress);

    while (true) {
        console.log("\n1. Mint Sneaker");
        console.log("2. List Sneaker");
        console.log("3. Buy Sneaker");
        console.log("4. Place Bid");
        console.log("5. Unlist Sneaker");
        console.log("6. Check Listing");
        console.log("7. View Minted Sneakers");
        console.log("8. Exit");

        const choice = readlineSync.question("Enter your choice: ");

        try {
            switch (choice) {
                case "1":
                    const amount = readlineSync.question("Enter amount of shares: ");
                    const metadata = readlineSync.question("Enter metadata URI: ");
                    const tx = await sneakerToken.mintSneakerToken(deployer.address, amount, metadata);
                    await tx.wait();
                    console.log("Sneaker minted successfully.");
                    break;
                case "2":
                    const tokenId = readlineSync.question("Enter token ID: ");
                    const listAmount = readlineSync.question("Enter amount to list: ");
                    const price = readlineSync.question("Enter price per share (in ETH): ");
                    await marketplace.listSneaker(
                        tokenId,
                        listAmount,
                        hre.ethers.parseEther(price)
                    );
                    console.log("Sneaker listed successfully.");
                    break;
                case "3":
                    const buyTokenId = readlineSync.question("Enter token ID: ");
                    const buyAmount = readlineSync.question("Enter amount to buy: ");
                    const listing = await marketplace.getListing(buyTokenId);
                    const totalPrice = listing.price * BigInt(buyAmount);
                    const commission = (totalPrice * BigInt(5)) / BigInt(100);
                    await marketplace.purchaseSneaker(buyTokenId, buyAmount, {
                        value: totalPrice + commission
                    });
                    console.log("Sneaker purchased successfully.");
                    break;
                case "4":
                    const bidTokenId = readlineSync.question("Enter token ID: ");
                    const bidAmount = readlineSync.question("Enter bid amount: ");
                    const bidPrice = readlineSync.question("Enter bid price per share (in ETH): ");
                    await marketplace.placeBid(
                        bidTokenId,
                        bidAmount,
                        hre.ethers.parseEther(bidPrice)
                    );
                    console.log("Bid placed successfully.");
                    break;
                case "5":
                    const unlistTokenId = readlineSync.question("Enter token ID: ");
                    await marketplace.unlistSneaker(unlistTokenId);
                    console.log("Sneaker unlisted successfully.");
                    break;
                case "6":
                    const checkTokenId = readlineSync.question("Enter token ID: ");
                    const checkListing = await marketplace.getListing(checkTokenId);
                    console.log("Listing details:", {
                        seller: checkListing.seller,
                        price: hre.ethers.formatEther(checkListing.price),
                        shareAmt: checkListing.shareAmt,
                        bidProcess: checkListing.bidProcess
                    });
                    break;
                case "7":
                    await viewMintedSneakers(sneakerToken, deployer.address);
                    break;
                case "8":
                    process.exit(0);
                default:
                    console.log("Invalid choice. Please try again.");
            }
        } catch (error) {
            console.error("An error occurred:", error.message);
        }
    }
}

async function viewMintedSneakers(sneakerToken, address) {
    try {
        // Get the total number of tokens minted
        const totalTokens = await sneakerToken._tokenIds();
        console.log("\nMinted Sneakers:");
        console.log("----------------");

        for (let tokenId = 1; tokenId <= totalTokens; tokenId++) {
            try {
                // Check if token exists
                const balance = await sneakerToken.balanceOf(address, tokenId);
                if (balance > 0) {
                    const metadata = await sneakerToken.getSneakerMetadata(tokenId);
                    const maxShares = await sneakerToken.maxShares(tokenId);
                    console.log(`\nToken ID: ${tokenId}`);
                    console.log(`Balance: ${balance}`);
                    console.log(`Max Shares: ${maxShares}`);
                    console.log(`Metadata URI: ${metadata}`);
                    console.log("----------------");
                }
            } catch (error) {
                // Skip invalid tokens
                continue;
            }
        }
    } catch (error) {
        console.error("Error viewing sneakers:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});