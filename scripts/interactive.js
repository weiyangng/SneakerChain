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
                        const metadata = readlineSync.question("Enter shoe listing title: ");
                        const tx = await sneakerToken.mintSneakerToken(deployer.address, amount, metadata);
                        const receipt = await tx.wait();

                        // Parse the tokenId from the Mint event
                        const mintEvent = receipt.logs.find(log =>
                            log.fragment && log.fragment.name === "TransferSingle"
                        );

                        if (mintEvent) {
                            const tokenId = mintEvent.args.id;
                            console.log(`Sneaker minted successfully. Token ID: ${tokenId}`);
                        } else {
                            console.log("Sneaker minted successfully. (Token ID could not be retrieved from logs)");
                        }
                        break;

                    case "2":
                        const tokenId = readlineSync.question("Enter token ID: ");
                        const listAmount = readlineSync.question("Enter amount to list: ");
                        const price = readlineSync.question("Enter price per share (in ETH): ");
                    
                        // Ownership check
                        const isOwner = await sneakerToken.isOwnerOfSneaker(tokenId, deployer.address);
                        if (!isOwner) {
                            console.error("You do not own this sneaker token.");
                            break;
                        }
                    
                        // Balance check
                        const balance = await sneakerToken.balanceOf(deployer.address, tokenId);
                        if (balance < listAmount) {
                            console.error(`Insufficient shares. You own ${balance}, but tried to list ${listAmount}.`);
                            break;
                        }
                    
                        // Approval check
                        const isApproved = await sneakerToken.isApprovedForAll(deployer.address, marketplace.target);
                        if (!isApproved) {
                            console.log("Approving marketplace to manage your tokens...");
                            const approveTx = await sneakerToken.setApprovalForAll(marketplace.target, true);
                            await approveTx.wait();
                            console.log("Marketplace approved.");
                        }
                    
                        try {
                            const priceInWei = hre.ethers.parseEther(price);
                            const listTx = await marketplace.listSneaker(tokenId, listAmount, priceInWei);
                            await listTx.wait();
                    
                            console.log("\nSneaker listed successfully!");
                            console.log(`Token ID: ${tokenId}`);
                            console.log(`Shares Listed: ${listAmount}`);
                            console.log(`Price per Share: ${price} ETH`);
                            console.log(`Listing Contract: ${marketplace.target}`);
                        } catch (err) {
                            console.error(" Listing failed:", err.message);
                        }
                        break;
                            
                    case "3":
                        const buyTokenId = readlineSync.question("Enter token ID: ");
                        const buyAmount = readlineSync.question("Enter amount to buy: ");
                    
                        try {
                            const listing = await marketplace.getListing(buyTokenId);
                    
                            if (listing.price === 0n || listing.shareAmt === 0n) {
                                console.log("No active listing found for this token ID.");
                                break;
                            }
                    
                            if (listing.shareAmt < BigInt(buyAmount)) {
                                console.log(`Only ${listing.shareAmt} shares available. You requested ${buyAmount}.`);
                                break;
                            }
                    
                            const pricePerShare = listing.price;
                            const totalPrice = pricePerShare * BigInt(buyAmount);
                            const commission = (totalPrice * 5n) / 100n;
                            const totalToPay = totalPrice + commission;
                    
                            console.log("\nPurchase Summary");
                            console.log("---------------------");
                            console.log(`Token ID: ${buyTokenId}`);
                            console.log(`Shares: ${buyAmount}`);
                            console.log(`Price per share: ${hre.ethers.formatEther(pricePerShare)} ETH`);
                            console.log(`Total (including 5% commission): ${hre.ethers.formatEther(totalToPay)} ETH`);
                            console.log(`Seller: ${listing.seller}`);
                            console.log("");
                    
                            const confirm = readlineSync.question("Proceed with purchase? (yes/no): ");
                            if (confirm.toLowerCase() !== "yes") {
                                console.log("Purchase cancelled.");
                                break;
                            }
                    
                            const buyTx = await marketplace.purchaseSneaker(buyTokenId, buyAmount, {
                                value: totalToPay
                            });
                            await buyTx.wait();
                    
                            console.log("Sneaker purchased successfully.");
                        } catch (err) {
                            if (err.message.includes("This listing does not exist")) {
                                console.log("No active listing found for this token ID.");
                            } else {
                                console.error("Purchase failed:", err.message);
                            }
                        }
                        break;

                    case "4":
                        const bidTokenId = readlineSync.question("Enter token ID: ");
                        const bidAmount = readlineSync.question("Enter bid amount (number of shares): ");
                        const bidPrice = readlineSync.question("Enter bid price per share (in ETH): ");
                    
                        try {
                            const listing = await marketplace.getListing(bidTokenId);
                    
                            if (listing.price === 0n || !listing.bidProcess) {
                                console.log("This token is not currently accepting bids.");
                                break;
                            }
                    
                            const currentTime = Math.floor(Date.now() / 1000);
                            if (listing.bidEndTime < currentTime) {
                                console.log("The bidding period for this token has ended.");
                                break;
                            }
                    
                            // Fetch current highest bid if contract supports it
                            let highestBidPerShare = null;
                            try {
                                const highestBid = await marketplace.getHighestBid(bidTokenId);
                                highestBidPerShare = highestBid.bidPrice;
                                console.log(`Current highest bid per share: ${hre.ethers.formatEther(highestBidPerShare)} ETH`);
                            } catch {
                                console.log("No bids have been placed yet.");
                            }
                    
                            const userBidPrice = hre.ethers.parseEther(bidPrice);
                            if (highestBidPerShare !== null && userBidPrice <= highestBidPerShare) {
                                const minIncrement = hre.ethers.parseEther("0.01");
                                if ((userBidPrice - highestBidPerShare) < minIncrement) {
                                    console.log("Your bid must be at least 0.01 ETH higher than the current highest bid.");
                                    break;
                                }
                            }
                    
                            const totalBid = userBidPrice * BigInt(bidAmount);
                            console.log("\nBid Summary");
                            console.log("-----------");
                            console.log(`Token ID: ${bidTokenId}`);
                            console.log(`Shares to Bid: ${bidAmount}`);
                            console.log(`Price per Share: ${bidPrice} ETH`);
                            console.log(`Total Bid: ${hre.ethers.formatEther(totalBid)} ETH`);
                            console.log(`Bid Ends: ${new Date(listing.bidEndTime * 1000).toLocaleString()}`);
                            console.log("");
                    
                            const confirm = readlineSync.question("Place this bid? (yes/no): ");
                            if (confirm.toLowerCase() !== "yes") {
                                console.log("Bid cancelled.");
                                break;
                            }
                    
                            const bidTx = await marketplace.placeBid(
                                bidTokenId,
                                bidAmount,
                                userBidPrice
                            );
                            await bidTx.wait();
                    
                            console.log("Bid placed successfully.");
                        } catch (error) {
                            console.error("Bid failed:", error.message);
                        }
                        break;

                    case "5":
                        const unlistTokenId = readlineSync.question("Enter token ID: ");
                    
                        try {
                            const listing = await marketplace.getListing(unlistTokenId);
                    
                            if (listing.price === 0n && listing.shareAmt === 0n) {
                                console.log("No active listing found for this token ID.");
                                break;
                            }
                    
                            if (listing.seller.toLowerCase() !== deployer.address.toLowerCase()) {
                                console.log("You are not the seller of this listing and cannot unlist it.");
                                break;
                            }
                    
                            console.log("\nListing Summary");
                            console.log("-----------------");
                            console.log(`Token ID: ${unlistTokenId}`);
                            console.log(`Seller: ${listing.seller}`);
                            console.log(`Price per Share: ${hre.ethers.formatEther(listing.price)} ETH`);
                            console.log(`Shares Listed: ${listing.shareAmt}`);
                            console.log("");
                    
                            const confirm = readlineSync.question("Do you want to unlist this sneaker? (yes/no): ");
                            if (confirm.toLowerCase() !== "yes") {
                                console.log("Unlisting cancelled.");
                                break;
                            }
                    
                            const unlistTx = await marketplace.unlistSneaker(unlistTokenId);
                            await unlistTx.wait();
                    
                            console.log("Sneaker unlisted successfully.");
                        } catch (error) {
                            if (error.message.includes("This listing does not exist")) {
                                console.log("No active listing found for this token ID.");
                            } else {
                                console.error("Unlisting failed:", error.message);
                            }
                        }
                        break;

                    case "6":
                        try {
                            const checkTokenId = readlineSync.question("Enter token ID: ");
                    
                            if (isNaN(checkTokenId) || Number(checkTokenId) <= 0) {
                                console.log("Invalid token ID.");
                                break;
                            }
                    
                            const listing = await marketplace.getListing(checkTokenId);
                    
                            if (listing.price === 0n && listing.shareAmt === 0n) {
                                console.log("No active listing found for this token ID.");
                                break;
                            }
                    
                            console.log("\nListing Details");
                            console.log("------------------");
                            console.log(`Token ID: ${checkTokenId}`);
                            console.log(`Seller: ${listing.seller}`);
                            console.log(`Price per Share: ${hre.ethers.formatEther(listing.price)} ETH`);
                            console.log(`Available Shares: ${listing.shareAmt}`);
                            console.log(`Bidding Status: ${listing.bidProcess ? "Active" : "Inactive"}`);
                    
                            if (listing.bidProcess) {
                                const bidEnd = new Date(listing.bidEndTime * 1000);
                                console.log(`Bid End Time: ${bidEnd.toLocaleString()}`);
                            }
                    
                            const isSeller = listing.seller.toLowerCase() === deployer.address.toLowerCase();
                            console.log(`You are ${isSeller ? "" : "not "}the seller of this listing.`);
                    
                        } catch (error) {
                            if (error.message.includes("This listing does not exist")) {
                                console.log("No active listing found for this token ID.");
                            } else {
                                console.error("Failed to retrieve listing:", error.message);
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