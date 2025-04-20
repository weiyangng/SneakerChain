# SneakerChain

SneakerChain is a decentralized marketplace for authenticated physical sneakers, represented on‑chain as ERC‑1155 tokens. Each sneaker—or fractional share of a high‑value sneaker—is minted as an NFT, providing immutable provenance and eliminating counterfeits. Buyers can purchase outright or participate in sealed‑bid auctions, with on‑chain downpayments and a pull‑over‑push escrow model that ensures secure, trustless settlements.

---

## 🚀 Features

- **Authentication & Provenance**  
  Physical sneakers are authenticated off‑chain, then minted on‑chain as ERC‑1155 tokens, with full ownership history recorded in the metadata.

- **Fractional Ownership**  
  Sneakers above a configurable threshold can be split into 100 shares, letting collectors buy a stake rather than the entire pair.

- **Instant Purchase & Auctions**  
  – **Buy Now** at a fixed price per share.  
  – **7‑day sealed‑bid auctions** with on‑chain downpayments, automated finalize‑after‑time, and pull‑pattern refunds & payouts.

- **Secure Escrow & Withdrawals**  
  All ETH is held in escrow until settlement; outbid bidders and sellers (plus platform commissions) “withdraw” their funds via a pull‑over‑push pattern.

- **Platform Commission**  
  A configurable fee on every sale is automatically tracked and withdrawable by the contract owner.

---

## 📦 Architecture

- **SneakerToken.sol**  
  - ERC‑1155 NFT with per‑token URIs and fractional shares  
  - `mintSneakerToken`, `burn`, ownership tracking  

- **SneakerMarketplace.sol**  
  - `listSneaker`, `unlistSneaker`, `purchaseSneaker`  
  - `placeBid`, `acceptBid`, `finalizeBid` (7‑day window)  
  - Escrow via `pendingReturns` mapping + `withdraw()`  

---

## 🔧 Prerequisites

- [Node.js (≥16)](https://nodejs.org/)  
- [Yarn](https://yarnpkg.com/) or npm  
- [Hardhat](https://hardhat.org/) (installed locally)  

---

## ⚙️ Installation

```shell
git clone https://github.com/your‑org/sneakerchain.git
cd sneakerchain
npm install

npx hardhat compile
npx hardhat node (On a seperate terminal)
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/interactive.js --network localhost
npx hardhat test
```

