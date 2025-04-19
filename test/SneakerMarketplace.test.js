const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("SneakerToken & SneakerMarketplace Integration", function () {
  let SneakerToken, token;
  let SneakerMarketplace, marketplace;
  let owner, seller, buyer1, buyer2, other;
  const COMMISSION = 5n; // 5%

  beforeEach(async function () {
    [owner, seller, buyer1, buyer2, other] = await ethers.getSigners();

    // 1) Deploy the ERC1155 token
    SneakerToken = await ethers.getContractFactory("SneakerToken", owner);
    token = await SneakerToken.deploy();
    await token.waitForDeployment();

    // 2) Deploy the Marketplace, pointing at the token and commission fee
    SneakerMarketplace = await ethers.getContractFactory(
      "SneakerMarketplace",
      owner
    );
    marketplace = await SneakerMarketplace.deploy(
      await token.getAddress(),
      COMMISSION
    );
    await marketplace.waitForDeployment();

    // 3) Approve the marketplace to move tokens on behalf of seller/buyers
    await token
      .connect(seller)
      .setApprovalForAll(await marketplace.getAddress(), true);
    await token
      .connect(buyer1)
      .setApprovalForAll(await marketplace.getAddress(), true);
    await token
      .connect(buyer2)
      .setApprovalForAll(await marketplace.getAddress(), true);
  });

  //helper functions
  async function mintSneaker(to, amount, metadata) {
    const tx = await token.mintSneakerToken(to, amount, metadata);
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (log) => log.fragment && log.fragment.name === "MintSNKT"
    );
    return event.args[1]; // tokenId is the second argument in the event
  }

  //helper functions
  async function mintAndGetId(account, amount, metadata) {
    const tokenId = await mintSneaker(account, amount, metadata);
    return tokenId;
  }

  describe("▶️ Minting", function () {
    it("Owner can mint and `sneakerOwners` is updated", async function () {
      const tokenId = await mintSneaker(seller, 10, "ipfs://panda");
      expect(await token.balanceOf(seller.address, tokenId)).to.equal(10);

      const isOwner = await token.isOwnerOfSneaker(tokenId, seller.address);
      expect(isOwner).to.be.true;
    });

    it("Non-owner cannot mint", async function () {
      await expect(
        token.connect(seller).mintSneakerToken(seller.address, 1, "uri")
      ).to.be.revertedWith("Caller is not the owner of the contract");
    });
  });

  describe("▶️ Listing & Unlisting", function () {
    beforeEach(async function () {
      this.tokenId = await mintAndGetId(seller, 50, "ipfs://listtest");
    });

    it("Seller lists whole NFT (non‑fractional) correctly", async function () {
      await expect(
        marketplace
          .connect(seller)
          .listSneaker(this.tokenId, 50, ethers.parseEther("1.0"), false)
      )
        .to.emit(marketplace, "SneakerListed")
        .withArgs(this.tokenId, seller.address, 50, ethers.parseEther("1.0"));

      const listing = await marketplace.getListing(this.tokenId);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(ethers.parseEther("1.0"));
      expect(listing.shareAmt).to.equal(50);
      expect(listing.isFractional).to.be.false;

      // Marketplace now holds those 50 shares
      expect(
        await token.balanceOf(await marketplace.getAddress(), this.tokenId)
      ).to.equal(50);
      expect(await token.balanceOf(seller.address, this.tokenId)).to.equal(0);
    });

    it("Seller can unlist and gets tokens back", async function () {
      // List first
      await marketplace
        .connect(seller)
        .listSneaker(this.tokenId, 20, ethers.parseEther("0.5"), true);

      // Unlist
      await expect(marketplace.connect(seller).unlistSneaker(this.tokenId)).to
        .not.be.reverted;

      // Listing is gone
      await expect(marketplace.getListing(this.tokenId)).to.be.revertedWith(
        "This listing does not exist"
      );

      // All shares back to seller
      expect(await token.balanceOf(seller.address, this.tokenId)).to.equal(50);
      expect(
        await token.balanceOf(await marketplace.getAddress(), this.tokenId)
      ).to.equal(0);
    });

    it("Non-owner cannot list", async function () {
      await expect(
        marketplace
          .connect(other)
          .listSneaker(this.tokenId, 10, ethers.parseEther("1"), false)
      ).to.be.revertedWith("Only token owners can list their tokens");
    });

    it("Cannot list with zero price or zero amount", async function () {
      await expect(
        marketplace.connect(seller).listSneaker(this.tokenId, 10, 0, false)
      ).to.be.revertedWith("Price must be greater than 0");
      await expect(
        marketplace
          .connect(seller)
          .listSneaker(this.tokenId, 0, ethers.parseEther("1"), false)
      ).to.be.revertedWith("Must list at least one share");
    });
  });

  describe("▶️ Direct Purchase & Commission", function () {
    beforeEach(async function () {
      this.tokenId = await mintAndGetId(seller, 30, "ipfs://buytest");
      // Seller lists 30 shares at 2 ETH each, fractional
      await marketplace
        .connect(seller)
        .listSneaker(this.tokenId, 30, ethers.parseEther("2.0"), true);
    });

    it("Buyer can purchase and ETH is escrowed", async function () {
      const listing = await marketplace.getListing(this.tokenId);
      const total = listing.price * BigInt(listing.shareAmt); // 2 ETH * 30
      const fee = (total * COMMISSION) / 100n; // 5% cut

      await expect(
        marketplace
          .connect(buyer1)
          .purchaseSneaker(this.tokenId, 30, { value: total })
      )
        .to.emit(marketplace, "SneakerPurchased")
        .withArgs(this.tokenId, buyer1.address, seller.address, 30, total);

      // Buyer got all 30 shares
      expect(await token.balanceOf(buyer1.address, this.tokenId)).to.equal(30);

      // Seller's proceeds = total - fee
      expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(
        total - fee
      );

      // Platform owner's commission
      expect(await marketplace.pendingWithdrawals(owner.address)).to.equal(fee);
    });

    it("Seller & owner can withdraw their ETH", async function () {
      const listing = await marketplace.getListing(this.tokenId);
      const total = listing.price * BigInt(listing.shareAmt);
      const fee = (total * COMMISSION) / 100n;

      // buyer purchases only 10 shares
      await marketplace
        .connect(buyer1)
        .purchaseSneaker(this.tokenId, 10, { value: listing.price * 10n });

      // Seller withdraws
      const beforeSeller = await ethers.provider.getBalance(seller.address);
      const tx1 = await marketplace.connect(seller).withdraw();
      const receipt1 = await tx1.wait();
      const gas1 = BigInt(receipt1.gasUsed) * BigInt(receipt1.gasPrice);
      const afterSeller = await ethers.provider.getBalance(seller.address);

      const expectedSellerAmount =
        (listing.price * 10n * (100n - COMMISSION)) / 100n;
      expect(BigInt(afterSeller) + gas1 - BigInt(beforeSeller)).to.equal(
        expectedSellerAmount
      );

      // Owner withdraws
      const beforeOwner = await ethers.provider.getBalance(owner.address);
      const tx2 = await marketplace.connect(owner).withdraw();
      const receipt2 = await tx2.wait();
      const gas2 = BigInt(receipt2.gasUsed) * BigInt(receipt2.gasPrice);
      const afterOwner = await ethers.provider.getBalance(owner.address);

      const expectedOwnerAmount = (listing.price * 10n * COMMISSION) / 100n;
      expect(BigInt(afterOwner) + gas2 - BigInt(beforeOwner)).to.equal(
        expectedOwnerAmount
      );
    });

    it("Reverts if insufficient ETH", async function () {
      const listing = await marketplace.getListing(this.tokenId);
      await expect(
        marketplace
          .connect(buyer2)
          .purchaseSneaker(this.tokenId, 5, { value: listing.price * 4n })
      ).to.be.revertedWith("Insufficient funds to purchase this sneaker");
    });
  });

  describe("▶️ Bidding Flow", function () {
    beforeEach(async function () {
      this.tokenId = await mintAndGetId(seller, 1, "ipfs://auction");
      // Seller lists the NFT
      await marketplace
        .connect(seller)
        .listSneaker(this.tokenId, 1, ethers.parseEther("3.0"), false);
    });

    it("Can place and update bids", async function () {
      // 1) Buyer1 places initial bid
      await expect(
        marketplace.connect(buyer1).placeBid(this.tokenId, {
          value: ethers.parseEther("2.0"),
        })
      )
        .to.emit(marketplace, "InitialBidSubmitted")
        .withArgs(this.tokenId, buyer1.address, ethers.parseEther("2.0"));

      // 2) Seller accepts the initial bid
      await marketplace.connect(seller).acceptBid(this.tokenId, 1);

      // 3) Buyer2 places higher bid
      await expect(
        marketplace.connect(buyer2).placeBid(this.tokenId, {
          value: ethers.parseEther("2.5"),
        })
      )
        .to.emit(marketplace, "BidPlaced")
        .withArgs(this.tokenId, buyer2.address, ethers.parseEther("2.5"));

      // 4) Check current bid
      const currentBid = await marketplace.currentBid(this.tokenId);
      expect(currentBid.bidder).to.equal(buyer2.address);
      expect(currentBid.bidPrice).to.equal(ethers.parseEther("2.5"));
    });

    it("Cannot place bid lower than current bid", async function () {
      // Place initial bid
      await marketplace.connect(buyer1).placeBid(this.tokenId, {
        value: ethers.parseEther("2.0"),
      });

      // Seller accepts the initial bid
      await marketplace.connect(seller).acceptBid(this.tokenId, 1);

      // Try to place lower bid
      await expect(
        marketplace.connect(buyer2).placeBid(this.tokenId, {
          value: ethers.parseEther("1.5"),
        })
      ).to.be.revertedWith("Bid must be higher than current bid price");
    });

    it("Seller can accept bid and complete sale", async function () {
      // Place bid
      await marketplace.connect(buyer1).placeBid(this.tokenId, {
        value: ethers.parseEther("2.0"),
      });

      // Accept bid
      await marketplace.connect(seller).acceptBid(this.tokenId, 1);

      // Check token transfer
      expect(await token.balanceOf(buyer1.address, this.tokenId)).to.equal(0);
      expect(await token.balanceOf(seller.address, this.tokenId)).to.equal(0);
      expect(
        await token.balanceOf(await marketplace.getAddress(), this.tokenId)
      ).to.equal(1);

      // Check funds distribution
      const fee = (ethers.parseEther("2.0") * COMMISSION) / 100n;
      expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(0);
      expect(await marketplace.pendingWithdrawals(owner.address)).to.equal(0);

      // Fast forward time and finalize bid
      await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await network.provider.send("evm_mine");
      await marketplace.connect(seller).finaliseBid(this.tokenId);

      // Now check final token balances
      expect(await token.balanceOf(buyer1.address, this.tokenId)).to.equal(1);
      expect(await token.balanceOf(seller.address, this.tokenId)).to.equal(0);
      expect(
        await token.balanceOf(await marketplace.getAddress(), this.tokenId)
      ).to.equal(0);

      // Check final funds distribution
      expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(
        ethers.parseEther("2.0") - fee
      );
      expect(await marketplace.pendingWithdrawals(owner.address)).to.equal(fee);
    });
  });

  describe("▶️ Physical Redemption", function () {
    it("Full owner can redeem physical sneaker", async function () {
      // Mint and list whole sneaker (1 token)
      const tokenId = await mintAndGetId(seller, 1, "ipfs://redeem");
      await marketplace
        .connect(seller)
        .listSneaker(tokenId, 1, ethers.parseEther("1"), false);

      // Buy whole sneaker
      await marketplace
        .connect(buyer1)
        .purchaseSneaker(tokenId, 1, { value: ethers.parseEther("1") });

      // Redeem
      await expect(marketplace.connect(buyer1).redeemSneaker(tokenId))
        .to.emit(marketplace, "SneakerRedeemed")
        .withArgs(tokenId, buyer1.address);

      // Verify token burned
      expect(await token.balanceOf(buyer1.address, tokenId)).to.equal(0);
    });

    it("Cannot redeem fractional shares", async function () {
      const tokenId = await mintAndGetId(seller, 100, "ipfs://redeem-fail");
      await marketplace
        .connect(seller)
        .listSneaker(tokenId, 100, ethers.parseEther("0.1"), true);
      await marketplace
        .connect(buyer1)
        .purchaseSneaker(tokenId, 50, { value: ethers.parseEther("5") });

      await expect(
        marketplace.connect(buyer1).redeemSneaker(tokenId)
      ).to.be.revertedWith("Fractional shares cannot be redeemed");
    });
  });

  describe("▶️ 100 Share Standardization", function () {
    it("Follows 1 token or 100 shares model", async function () {
      // Test whole sneaker (1 token)
      const wholeTokenId = await mintAndGetId(seller, 1, "ipfs://whole");
      expect(await token.getMaxShares(wholeTokenId)).to.equal(1);

      // Test fractional (100 shares)
      const fractionalTokenId = await mintAndGetId(
        seller,
        100,
        "ipfs://fractional"
      );
      expect(await token.getMaxShares(fractionalTokenId)).to.equal(100);
    });
  });
});
