const hre = require("hardhat");
const readlineSync = require("readline-sync");

async function main() {
    try {
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

        // Verify contracts are connected
        try {
            await sneakerToken._tokenIds();
            await marketplace.commissionFee();
            console.log("Successfully connected to contracts!");
        } catch (error) {
            console.error("Error connecting to contracts. Please make sure:");
            console.error("1. The local network is running (npx hardhat node)");
            console.error("2. The contract addresses are correct");
            console.error("3. The contracts are deployed to the network");
            process.exit(1);
        }

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
                        
                        // Check if user owns the token
                        const isOwner = await sneakerToken.isOwnerOfSneaker(tokenId, deployer.address);
                        if (!isOwner) {
                            console.error("Error: You do not own this sneaker token");
                            break;
                        }

                        // Check user's balance
                        const balance = await sneakerToken.balanceOf(deployer.address, tokenId);
                        if (balance < listAmount) {
                            console.error(`Error: You only have ${balance} shares, but trying to list ${listAmount}`);
                            break;
                        }

                        // Approve marketplace if not already approved
                        const isApproved = await sneakerToken.isApprovedForAll(deployer.address, marketplace.target);
                        if (!isApproved) {
                            console.log("Approving marketplace to handle your tokens...");
                            const approveTx = await sneakerToken.setApprovalForAll(marketplace.target, true);
                            await approveTx.wait();
                        }

                        // List the sneaker
                        const listTx = await marketplace.listSneaker(
                            tokenId,
                            listAmount,
                            hre.ethers.parseEther(price)
                        );
                        await listTx.wait();
                        console.log("Sneaker listed successfully.");
                        break;
                    case "3":
                        const buyTokenId = readlineSync.question("Enter token ID: ");
                        const buyAmount = readlineSync.question("Enter amount to buy: ");
                        const listing = await marketplace.getListing(buyTokenId);
                        const totalPrice = listing.price * BigInt(buyAmount);
                        const commission = (totalPrice * BigInt(5)) / BigInt(100);
                        const buyTx = await marketplace.purchaseSneaker(buyTokenId, buyAmount, {
                            value: totalPrice + commission
                        });
                        await buyTx.wait();
                        console.log("Sneaker purchased successfully.");
                        break;
                    case "4":
                        const bidTokenId = readlineSync.question("Enter token ID: ");
                        const bidAmount = readlineSync.question("Enter bid amount: ");
                        const bidPrice = readlineSync.question("Enter bid price per share (in ETH): ");
                        const bidTx = await marketplace.placeBid(
                            bidTokenId,
                            bidAmount,
                            hre.ethers.parseEther(bidPrice)
                        );
                        await bidTx.wait();
                        console.log("Bid placed successfully.");
                        break;
                    case "5":
                        const unlistTokenId = readlineSync.question("Enter token ID: ");
                        const unlistTx = await marketplace.unlistSneaker(unlistTokenId);
                        await unlistTx.wait();
                        console.log("Sneaker unlisted successfully.");
                        break;
                    case "6":
                        try {
                            const checkTokenId = readlineSync.question("Enter token ID: ");
                            const checkListing = await marketplace.getListing(checkTokenId);
                            
                            if (checkListing.price === 0n) {
                                console.log("No active listing found for this token ID.");
                            } else {
                                console.log("\nListing details:");
                                console.log("----------------");
                                console.log(`Seller: ${checkListing.seller}`);
                                console.log(`Price per share: ${hre.ethers.formatEther(checkListing.price)} ETH`);
                                console.log(`Available shares: ${checkListing.shareAmt}`);
                                console.log(`Bidding process: ${checkListing.bidProcess ? "Active" : "Inactive"}`);
                                if (checkListing.bidProcess) {
                                    console.log(`Bid end time: ${new Date(checkListing.bidEndTime * 1000).toLocaleString()}`);
                                }
                            }
                        } catch (error) {
                            if (error.message.includes("This listing does not exist")) {
                                console.log("No active listing found for this token ID.");
                            } else {
                                throw error;
                            }
                        }
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
                if (error.code === 'ECONNRESET') {
                    console.error("\nConnection to the network was reset. Please make sure:");
                    console.error("1. The local network is still running (npx hardhat node)");
                    console.error("2. Try running the script again");
                } else {
                    console.error("An error occurred:", error.message);
                }
            }
        }
    } catch (error) {
        console.error("Fatal error:", error.message);
        process.exit(1);
    }
}

async function viewMintedSneakers(sneakerToken, address) {
    try {
        const totalTokens = await sneakerToken._tokenIds();
        console.log("\nMinted Sneakers:");
        console.log("----------------");

        for (let tokenId = 1; tokenId <= totalTokens; tokenId++) {
            try {
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