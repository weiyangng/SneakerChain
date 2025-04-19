const hre = require("hardhat");
const readlineSync = require("readline-sync");
const { ethers } = require("hardhat");

let provider;
let sneakerToken;
let marketplace;

async function checkConnection() {
    try {
        await provider.getNetwork();
        return true;
    } catch (error) {
        return false;
    }
}

async function reconnect() {
    try {
        provider = hre.ethers.provider;
        const [deployer] = await hre.ethers.getSigners();
        
        // Reattach contracts
        const SneakerToken = await hre.ethers.getContractFactory("SneakerToken");
        sneakerToken = SneakerToken.attach(sneakerToken.target);
        
        const SneakerMarketplace = await hre.ethers.getContractFactory("SneakerMarketplace");
        marketplace = SneakerMarketplace.attach(marketplace.target);
        
        return deployer;
    } catch (error) {
        throw error;
    }
}

async function executeWithRetry(operation, retries = 5, delay = 3000) {
    for (let i = 0; i < retries; i++) {
        try {
            // Check connection health before each operation
            if (!await checkConnection()) {
                await reconnect();
            }
            return await operation();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function readWithRetry(contract, method, ...args) {
    return executeWithRetry(async () => {
        try {
            return await contract[method](...args);
        } catch (error) {
            if (error.message.includes("ECONNRESET")) {
                // For read operations, we can be more aggressive with retries
                throw new Error("Connection reset during read operation");
            }
            throw error;
        }
    }, 5, 3000); // More retries and longer delay for reads
}

async function connectToNetwork(retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const [deployer] = await hre.ethers.getSigners();
            console.log(`Attempt ${i + 1}/${retries} to connect to network...`);
            // Test the connection
            await deployer.provider.getNetwork();
            console.log("Successfully connected to network!");
            return deployer;
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Connection attempt ${i + 1} failed. Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function main() {
    try {
        // Initial setup
        provider = hre.ethers.provider;
        const [deployer] = await hre.ethers.getSigners();
        console.log("Using deployer account:", deployer.address);

        // Get contract addresses
        const tokenAddress = readlineSync.question("Enter the SneakerToken contract address: ");
        const marketplaceAddress = readlineSync.question("Enter the SneakerMarketplace contract address: ");

        // Attach to deployed contracts
        const SneakerToken = await hre.ethers.getContractFactory("SneakerToken");
        sneakerToken = SneakerToken.attach(tokenAddress);

        const SneakerMarketplace = await hre.ethers.getContractFactory("SneakerMarketplace");
        marketplace = SneakerMarketplace.attach(marketplaceAddress);

        // Verify contracts are connected
        try {
            await executeWithRetry(async () => {
                await sneakerToken._tokenIds();
                await marketplace.commissionFee();
            });
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
            console.log("5. Redeem Sneaker");
            console.log("6. Check Listing");
            console.log("7. View Minted Sneakers");
            console.log("8. Exit");

            const choice = readlineSync.question("Enter your choice: ");

            try {
                // Check connection before each operation
                if (!await checkConnection()) {
                    await reconnect();
                }

                switch (choice) {
                    case "1": // Mint Sneaker
                        const amount = readlineSync.question("Enter amount of shares (1 for whole sneaker, 100 for fractional): ");
                        const metadata = readlineSync.question("Enter sneaker metadata URI: ");
                        await executeWithRetry(async () => {
                            const tx = await sneakerToken.mintSneakerToken(deployer.address, amount, metadata);
                            const receipt = await tx.wait();
                            const mintEvent = receipt.logs.find(log =>
                                log.fragment && log.fragment.name === "TransferSingle"
                            );
                            if (mintEvent) {
                                const tokenId = mintEvent.args.id;
                                console.log(`Sneaker minted successfully. Token ID: ${tokenId}`);
                            } else {
                                console.log("Sneaker minted successfully. (Token ID could not be retrieved from logs)");
                            }
                        });
                        break;

                    case "2": // List Sneaker
                        const tokenId = readlineSync.question("Enter token ID: ");
                        const listAmount = readlineSync.question("Enter amount to list: ");
                        const price = readlineSync.question("Enter price per share (in ETH): ");
                        const isFractional = readlineSync.question("Is this a fractional listing? (yes/no): ").toLowerCase() === "yes";

                        // Ownership check
                        const isOwner = await executeWithRetry(() => sneakerToken.isOwnerOfSneaker(tokenId, deployer.address));
                        if (!isOwner) {
                            console.error("You do not own this sneaker token.");
                            break;
                        }

                        // Balance check
                        const balance = await executeWithRetry(() => sneakerToken.balanceOf(deployer.address, tokenId));
                        if (balance < listAmount) {
                            console.error(`Insufficient shares. You own ${balance}, but tried to list ${listAmount}.`);
                            break;
                        }

                        // Approval check
                        const isApproved = await executeWithRetry(() => sneakerToken.isApprovedForAll(deployer.address, marketplace.target));
                        if (!isApproved) {
                            console.log("Approving marketplace to manage your tokens...");
                            await executeWithRetry(async () => {
                                const approveTx = await sneakerToken.setApprovalForAll(marketplace.target, true);
                                await approveTx.wait();
                            });
                            console.log("Marketplace approved.");
                        }

                        await executeWithRetry(async () => {
                            const priceInWei = hre.ethers.parseEther(price);
                            const listTx = await marketplace.listSneaker(tokenId, listAmount, priceInWei, isFractional);
                            await listTx.wait();
                            console.log("\nSneaker listed successfully!");
                            console.log(`Token ID: ${tokenId}`);
                            console.log(`Shares Listed: ${listAmount}`);
                            console.log(`Price per Share: ${price} ETH`);
                            console.log(`Listing Contract: ${marketplace.target}`);
                        });
                        break;

                    case "3": // Buy Sneaker
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

                    case "4": // Place Bid
                        const bidTokenId = readlineSync.question("Enter token ID: ");
                        try {
                            const bidPrice = readlineSync.question("Enter bid price (in ETH): ");
                            const userBidPrice = hre.ethers.parseEther(bidPrice);
                            
                            await executeWithRetry(async () => {
                                const bidTx = await marketplace.placeBid(bidTokenId, {
                                    value: userBidPrice
                                });
                                await bidTx.wait();
                                console.log("Bid placed successfully.");
                            });
                        } catch (error) {
                            console.error("Bid failed:", error.message);
                        }
                        break;

                    case "5": // Redeem Sneaker
                        const redeemTokenId = readlineSync.question("Enter token ID to redeem: ");

                        try {
                            const redeemTx = await marketplace.redeemSneaker(redeemTokenId);
                            await redeemTx.wait();

                            console.log("Sneaker redeemed successfully.");
                        } catch (error) {
                            console.error("Redemption failed:", error.message);
                        }
                        break;

                    case "6": // Check Listing
                        const checkTokenId = readlineSync.question("Enter token ID: ");

                        try {
                            await checkListing(marketplace, checkTokenId);
                        } catch (error) {
                            console.error("Failed to retrieve listing:", error.message);
                        }
                        break;

                    case "7": // View Minted Sneakers
                        await viewMintedSneakers(sneakerToken, deployer.address);
                        break;

                    case "8": // Exit
                        process.exit(0);

                    default:
                        console.log("Invalid choice. Please try again.");
                }
            } catch (error) {
                console.error("An error occurred:", error.message);
                console.log("Please try the operation again.");
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

async function checkListing(marketplace, tokenId) {
    try {
        const listing = await readWithRetry(marketplace, "getListing", tokenId);
        
        if (listing.price === 0n && listing.shareAmt === 0n) {
            console.log("No active listing found for this token ID.");
            return;
        }

        console.log("\nListing Details");
        console.log("------------------");
        console.log(`Token ID: ${tokenId}`);
        console.log(`Price per Share: ${ethers.formatEther(listing.price)} ETH`);
        console.log(`Available Shares: ${listing.shareAmt}`);
        
        // Show bidding status
        if (listing.initialBidSubmitted) {
            const currentBid = await readWithRetry(marketplace, "currentBid", tokenId);
            if (currentBid.bidPrice > 0n) {
                console.log(`Current Bid: ${ethers.formatEther(currentBid.bidPrice)} ETH`);
            }
        }
    } catch (error) {
        if (error.message.includes("This listing does not exist")) {
            console.log("No active listing found for this token ID.");
        } else {
            console.error("Failed to retrieve listing:", error.message);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});