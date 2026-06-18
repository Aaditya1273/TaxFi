# TaxFi — Your Crypto Tax Agent That Pays for Itself

[![CI](https://github.com/your-org/taxfi/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/taxfi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MetaMask Smart Accounts](https://img.shields.io/badge/MetaMask-Smart%20Accounts-orange)](https://metamask.io)
[![Venice AI](https://img.shields.io/badge/Powered%20By-Venice%20AI-8B5CF6)](https://venice.ai)
[![1Shot API](https://img.shields.io/badge/Gasless-1Shot%20API-00C853)](https://1shotapi.com)

TaxFi is a **non-custodial, agentic crypto tax platform** built for the **MetaMask Smart Accounts Kit × 1Shot API × Venice AI Dev Cook Off**. It uses a multi-agent pipeline that scans wallets across Ethereum, Base, and Arbitrum, classifies every transaction using Venice AI, finds optimal cost basis methods (HIFO by default), identifies tax-loss harvesting opportunities, and generates IRS-ready forms — all **gasless** and **privacy-first**.

---

## Table of Contents

1. [The Problem & The Solution](#1-the-problem--the-solution)
2. [Architecture Overview](#2-architecture-overview)
3. [Multi-Agent Pipeline](#3-multi-agent-pipeline)
4. [Venice AI Integration](#4-venice-ai-integration)
5. [Smart Account & Permission System](#5-smart-account--permission-system)
6. [Smart Contracts](#6-smart-contracts)
7. [Tech Stack](#7-tech-stack)
8. [Frontend Pages](#8-frontend-pages)
9. [Backend API](#9-backend-api)
10. [Environment Variables](#10-environment-variables)
11. [Getting Started](#11-getting-started)
12. [Production Deployment](#12-production-deployment)
13. [Security](#13-security)

---

## 1. The Problem & The Solution

### The Problem

Crypto tax compliance is **broken** for the average DeFi user:

| Pain Point | Description |
|---|---|
| **Manual tracking** | Users manually categorize 100s-1000s of DeFi transactions across multiple chains |
| **Missed savings** | Most users don't know about tax-loss harvesting, leaving thousands in potential savings unrealized |
| **Custodial risks** | Existing tax platforms require API keys with full wallet access or screen-scraping |
| **Subscription fees** | Most tax software charges $100-500/year regardless of actual value delivered |
| **Griefing** | Paid subscriptions whether or not the user has a tax liability |
| **Privacy** | Tax data is sent to centralized AI providers (OpenAI, Anthropic) where it trains public models |
| **IRS complexity** | Form 8949, Schedule D, wash sale rules, HIFO vs FIFO — most users need a CPA |

### The Solution

TaxFi solves all of these with a **privacy-first, non-custodial, agentic platform**:

| Solution | How TaxFi Addresses It |
|---|---|
| **Automated classification** | 6-agent pipeline scans all chains, classifies 20+ transaction types via Venice AI |
| **Tax-loss harvesting** | Real-time detection of harvestable losses with estimated savings scoring |
| **Non-custodial** | ERC-7715 read-only permissions + periodic spend limits. Users never give up wallet control |
| **Pay only on savings** | 5% fee on _realized_ tax savings. No subscription. If TaxFi doesn't save you money, you pay nothing |
| **Gasless execution** | 1Shot relayer pays gas in USDC via ERC-7710 delegated transactions. Users never need ETH |
| **Privacy-first** | Venice AI TEE (Trusted Execution Environment) inference. Prompts never stored, never train models |
| **IRS-ready forms** | Auto-generated Form 8949, Schedule D, Schedule 1 with onchain hash attestation for audit trail |

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           User's Wallets                                    │
│                (Ethereum · Base · Arbitrum — read-only via ERC-7715)        │
└──────────────────┬──────────────────────────────┬──────────────────────────┘
                   │                              │
         ┌─────────▼──────────┐          ┌────────▼──────────┐
         │  Wagmi/RainbowKit  │          │  ERC-7715 Wallet  │
         │  (Read access)     │          │  (Harvest permit) │
         └─────────┬──────────┘          └────────┬──────────┘
                   │                              │
                   ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (Multi-Agent Pipeline)                   │
│                                                                              │
│  ┌──────────────┐   ┌────────────────┐   ┌──────────────┐   ┌────────────┐ │
│  │ Ingest Agent │──▶│Classifier Agent│──▶│ Basis Agent  │──▶│LossDetector│ │
│  │ (Covalent)   │   │ (Venice AI)    │   │ (HIFO/FIFO)  │   │ (Harvest)  │ │
│  └──────────────┘   └────────────────┘   └──────────────┘   └─────┬──────┘ │
│                                                                    │        │
│                                                ┌───────────────────┼────┐   │
│                                                ▼                   ▼    │   │
│                                        ┌──────────────┐   ┌──────────┐  │   │
│                                        │Form Generator│   │ Executor │  │   │
│                                        │(IRS Forms)   │   │ (1Shot)  │  │   │
│                                        └──────────────┘   └──────────┘  │   │
│                                                │              │          │   │
│                                                ▼              ▼          │   │
│                                        ┌──────────────┐   ┌──────────┐  │   │
│                                        │  Form PDFs   │   │   USDC   │  │   │
│                                        │ + Onchain    │   │ to User  │  │   │
│                                        │  Attestation │   │  Wallet  │  │   │
│                                        └──────────────┘   └──────────┘  │   │
└─────────────────────────────────────────────────────────────────────────────┘
                   │                              │
                   ▼                              ▼
┌──────────────────────────────────┐   ┌──────────────────────────┐
│         Next.js Frontend          │   │   1Shot Public Relayer   │
│  /dashboard · /portfolio          │   │   (ERC-7710 Gasless      │
│  /harvest · /reports              │   │    Delegated Txns)       │
│  /permissions · /settings         │   └──────────────────────────┘
└──────────────────────────────────┘
```

### Communication Flow

| Channel | Protocol | Auth | Description |
|---|---|---|---|
| Frontend ↔ Backend | REST (HTTP/2) | JWT Bearer Token | All CRUD operations, pipeline triggering |
| Frontend ↔ Backend | WebSocket | Same-origin | Real-time pipeline events, harvest execution updates |
| Backend ↔ Venice AI | REST (HTTPS) | Bearer Key / x402 SIWE | Transaction classification, harvest analysis |
| Backend ↔ 1Shot | JSON-RPC (HTTPS) | API Key | Gasless relayer for ERC-7710 delegations |
| Frontend ↔ MetaMask | EIP-1193 (Provider) | User signature | ERC-7715 permission signing, wallet connection |
| Backend ↔ Blockchain | JSON-RPC | None (public) | Onchain data via Covalent / Alchemy |

---

## 3. Multi-Agent Pipeline

The core of TaxFi is a **6-agent sequential pipeline**, each agent specializing in one domain:

### 3.1 Ingest Agent (`backend/agents/ingest_agent.py`)

- Pulls all transactions from **Ethereum Mainnet**, **Base**, and **Arbitrum**
- Data sources: Covalent API (primary) or Alchemy SDK (fallback)
- Normalizes transactions into a canonical format with chain ID, method signatures, token transfers, and internal operations
- Handles pagination, rate limits, and time-range queries

### 3.2 Classifier Agent (`backend/agents/classifier_agent.py`)

- Uses **Venice AI** (`zai-org-glm-5-1` model) to classify each transaction into 1 of 20+ tax-relevant categories
- Categories: `SWAP`, `AIRDROP`, `STAKING_REWARD`, `LP_DEPOSIT`, `LP_WITHDRAW`, `BRIDGE`, `TRANSFER_SELF`, `MINT`, `BURN`, `NFT_BUY`, `NFT_SELL`, `YIELD_HARVEST`, `GOVERNANCE_CLAIM`, `INTEREST`, `FEE`, `GAS`, `LIQUIDATION`, `BORROW`, `REPAY`, `OTHER`
- Returns structured JSON with confidence score, reasoning, and taxability
- Falls back to **rule-based classification** (heuristic method signatures + known DEX addresses) when Venice AI is unavailable
- Rule-based fallback is **honest** — it never returns mock data, and marks low-confidence classifications for manual review

### 3.3 Basis Agent (`backend/agents/basis_agent.py`)

- Tracks **cost basis ledgers** per asset per user
- Supports 5 methods:
  - **HIFO** (Highest In, First Out) — tax-optimal, default
  - **FIFO** (First In, First Out) — IRS default
  - **LIFO** (Last In, First Out)
  - **ACB** (Average Cost Basis)
  - **SpecID** (Specific Identification)
- Calculates realized gains/losses for each disposal event

### 3.4 Loss Detector (`backend/agents/loss_detector.py`)

- Scans all open positions for **unrealized losses**
- Evaluates **wash sale risk** (repurchase within 30 days)
- Scores and prioritizes opportunities by **estimated tax savings**
- Factors in: loss magnitude, holding period (short vs long term), income bracket, carry-forward losses

### 3.5 Form Generator (`backend/agents/form_generator.py`)

- Generates **IRS Form 8949** (Sales and Other Dispositions of Capital Assets)
- Generates **Schedule D** (Capital Gains and Losses)
- Generates **Schedule 1** (Additional Income and Adjustments to Income)
- Generates a **plain-English summary** for the user
- Anchors PDF hashes onchain via `TaxFormAttestor` for immutable audit trail
- Gated behind `TAXFI_FORM_DEV_MODE=true` in development

### 3.6 Executor Agent (`backend/agents/executor_agent.py`)

- Executes tax-loss harvests via the **1Shot gasless relayer**
- Builds ERC-7710 delegations with scope + executions
- Estimates relayer fee via `relayer_estimate7710Transaction`
- Submits via `relayer_send7710Transaction`
- Polls for completion via `relayer_getStatus`
- Relayer fee paid in USDC (user never needs ETH)

---

## 4. Venice AI Integration

TaxFi uses **Venice AI** as its primary intelligence layer across multiple components. Venice was chosen over OpenAI/Anthropic for three reasons:

| Reason | Detail |
|---|---|
| **Privacy** | Venice AI runs inference in TEEs (Trusted Execution Environments). Tax data never leaves encrypted memory and never trains public models |
| **Cost** | Venice is significantly cheaper for high-volume transaction classification |
| **Multi-modal** | Can read CSV screenshots and unstructured transaction exports |

### 4.1 Where Venice AI Is Used

| Component | Venice AI Function | Model | Output Format |
|---|---|---|---|
| **Classifier Agent** | Classify every transaction into 20+ tax categories | `zai-org-glm-5-1` | Structured JSON (json_schema) |
| **Loss Detector** | Analyze positions for optimal harvest timing & wash sale risk | `zai-org-glm-5-1` | Plain text analysis |
| **VeniceClient** | General-purpose classification, harvest analysis, explanations | `zai-org-glm-5-1` | JSON or text |

### 4.2 Authentication Methods

The `VeniceClient` (`backend/integrations/venice.py`) tries authentication methods in order:

1. **Bearer API Key** (`VENICE_API_KEY`) — Standard key-based auth via `Authorization: Bearer` header
2. **x402 Wallet SIWE** (`VENICE_WALLET_KEY` / `X402_WALLET_KEY`) — Wallet-based auth via Sign-In-With-Ethereum (EIP-4361) with Ed25519 signatures
3. **Rule-based fallback** — Heuristic classification using method signatures, DEX contract addresses, and token transfer patterns when Venice is unreachable

### 4.3 Classification Schema

Venice AI returns structured JSON (using OpenAI-compatible `response_format: json_schema`):

```json
{
  "category": "SWAP",
  "confidence": 0.95,
  "reasoning": "Method 'swapExactTokensForTokens' called on Uniswap V2 Router",
  "taxable": true,
  "basis_method": "HIFO",
  "cost_basis_asset": "ETH",
  "is_lp_event": false,
  "estimated_price": 2345.67,
  "notes": ""
}
```

### 4.4 x402 Payment Integration

When Venice returns HTTP 402 (insufficient balance), the system:
1. Parses the `PAYMENT-REQUIRED` header (x402 v2 format)
2. Extracts minimum suggested top-up amount
3. Triggers top-up via USDC on Base chain (EIP-3009 `transferWithAuthorization`)
4. Retries the request with updated headers

### 4.5 Rule-Based Fallback Classifier

When Venice AI is unavailable, the system falls back to a **deterministic rule-based classifier** that uses:
- **Method signatures**: `swap`, `approve`, `deposit`, `withdraw`, `mint`, `burn`
- **Known DEX contract addresses**: Uniswap V2/V3, SushiSwap, 1inch, 0x, Aave
- **Transfer analysis**: Outgoing + incoming tokens = swap, single transfer = transfer
- **Self-transfer detection**: From == To addresses
- **Zero-value detection**: Likely airdrop/claim

No mock data is ever returned. Low-confidence results are flagged for manual review.

---

## 5. Smart Account & Permission System

TaxFi implements a **two-layer permission model** combining ERC-7715 (user → agent) and ERC-7710 (agent → relayer):

### 5.1 Layer 1: ERC-7715 Advanced Permissions (User → TaxFi Agent)

Implemented via the **MetaMask Smart Accounts Kit** (`@metamask/smart-accounts-kit/actions`).

The `useMetaMaskPermissions` hook (`frontend/src/hooks/useMetaMaskPermissions.ts`) manages:

| Permission Type | Purpose | ERC-7715 Required? |
|---|---|---|
| Read-only access | User's addresses are already exposed via Wagmi wallet connection + public RPC | ❌ No |
| **ERC-20 Periodic Spend** | Agent can spend up to X USDC worth per period for harvest execution | ✅ Yes |

**Flow:**
1. User connects wallet (Wagmi/RainbowKit)
2. Hook initializes an ERC-7715 wallet client via `createWalletClient` + `erc7715ProviderActions`
3. Checks wallet capabilities via `getSupportedExecutionPermissions()`
4. Checks existing permissions via `getGrantedExecutionPermissions()`
5. User requests harvest permission via `requestExecutionPermissions()` with:
   - `type: 'erc20-token-periodic'`
   - `tokenAddress` (USDC)
   - `periodAmount` (max spend per period)
   - `periodDuration` (default: 1 day)
   - `expiry` (default: 365 days)
   - `isAdjustmentAllowed: true`
6. MetaMask shows the permission prompt to the user
7. On approval, the permission is stored onchain in `AgentPermissionRegistry`

### 5.2 Layer 2: ERC-7710 Delegated Transactions (Agent → 1Shot Relayer)

Implemented via the **1Shot API** (`backend/integrations/oneshot.py`).

The `ExecutorAgent` builds ERC-7710 delegations for gasless harvest execution:

1. Builds delegation with scope (`erc20-transfer-amount`) and caveats
2. Creates two executions:
   - Fee payment: USDC transfer to `feeCollector`
   - Harvest: Token swap to USDC via DEX
3. Estimates relayer fee via `relayer_estimate7710Transaction` (price-locked quote)
4. Submits via `relayer_send7710Transaction`
5. Polls for completion via `relayer_getStatus`

**Status codes:** 100=Pending, 110=Submitted, 200=Confirmed, 400=Rejected, 500=Reverted

### 5.3 Permission Context Flow

```
User signs ERC-7715 permission ──▶ AgentPermissionRegistry (onchain)
                                          │
ExecutorAgent reads permission ──────────▶ builds ERC-7710 delegation
                                          │
1Shot relayer validates delegation ──────▶ executes swap
                                          │
LossHarvestVault takes 5% fee ──────────▶ sends USDC to user
                                          │
Permission marked as consumed ──────────▶ prevents replay
```

### 5.4 EIP-7702 Smart Account Detection

The frontend checks if a user's EOA has been upgraded to a Smart Account via `eth_getCode`. Smart accounts have contract code at their address (non-empty code hash), indicating EIP-7702 delegation is set.

---

## 6. Smart Contracts

All contracts are written in **Solidity ^0.8.20** with viaIR + optimizer enabled (200 runs). Deployed on **Ethereum Sepolia** (chain ID 11155111).

### 6.1 Deployed Contracts

| Contract | Address (Sepolia) | Purpose |
|---|---|---|
| **AgentPermissionRegistry** | `0x4F7141763FeB5dB91178343d3c894E88992794A3` | ERC-7715 permission registry — granular, revocable user-granted permissions |
| **TaxFiAgentSmartAccount** | `0x401E5B592D1F56f335405079F13d49b81309f82f` | Agent smart account — rate-limited harvest execution, replay protection |
| **LossHarvestVault** | `0x2AF710af85914DEe0AA89017223638367645f6b4` | Receives harvested tokens, swaps to USDC via DEX, takes 5% fee |
| **TaxFormAttestor** | `0xff32FDd41F06b1a166d56677d1C5c0001251BF4C` | Anchors IRS form hashes onchain for immutable audit trail |
| **Agent Owner (EOA)** | `0x5aB3036C7d0bA7043E0BB531374dC6c732eC4954` | EOA that owns/deploys the contracts |
| **USDC (Sepolia)** | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Circle's official USDC on Sepolia |
| **Uniswap V3 Router** | `0xb41b78Ce3D1BDEDE48A3d303eD2564F6d1F6fff0` | Uniswap V3 SwapRouter02 on Sepolia |

### 6.2 AgentPermissionRegistry.sol

**Source:** `contracts/src/AgentPermissionRegistry.sol` (266 lines)

Core ERC-7715 compatible permission registry. Manages granular, revocable permissions from users to the TaxFi agent.

**Permission Types:**
- `READ_ONLY` — Informational only (no onchain execution)
- `ERC20_PERIODIC` — Periodic token spend limit (e.g., $100 USDC per day)
- `ERC20_AMOUNT` — One-time token spend limit
- `FUNCTION_CALL` — Specific function selector access

**Key Functions:**
- `grantPermission(address grantee, PermissionScope scope, uint256 validUntil)` — Grant a new permission, returns `permissionHash`
- `revokePermission(bytes32 permissionHash)` — Revoke a previously granted permission (only granter)
- `checkPermission(bytes32 permissionHash, uint256 amount, uint256 chainId, address target)` — Validate a permission for a given action
- `consumePermission(bytes32 permissionHash, uint256 amount)` — Record periodic consumption (prevents overspend)
- `getGranterPermissions(address granter, address grantee)` — List all permissions from a granter
- `getGranteePermissions(address grantee, address granter)` — List all permissions held by a grantee

**Safety Features:**
- Bidirectional indexing (granter → grantee and grantee → granter)
- Permission expiry with `validUntil`
- Revocable at any time via `revokePermission`
- Periodic consumption tracking per period window
- Chain-scoped permissions (restrict to specific chainIds)
- Target-scoped permissions (restrict to specific contract addresses)

### 6.3 TaxFiAgentSmartAccount.sol

**Source:** `contracts/src/TaxFiAgentSmartAccount.sol` (225 lines)

The smart account that the TaxFi agent uses to execute tax-loss harvests within the user's granted permission scope.

**Key Features:**
- **Rate-limited** per chain per day with configurable caps
- **Authorized executors** — Owner + whitelist of authorized backend executors
- **Pausable** — Emergency pause by owner
- **Replay protection** — `usedPermissions` mapping prevents permission reuse
- **Permission validation** — Checks against `AgentPermissionRegistry` before execution

**Key Functions:**
- `executeHarvest(permissionHash, user, tokenSold, amountSold, usdcOut, swapData, chainId)` — Execute harvest with permission validation + rate limiting
- `setRateLimit(uint256 chainId, uint256 dailyCap)` — Configure daily harvest cap per chain
- `authorizeExecutor(address executor, bool authorized)` — Whitelist harvest executors
- `pause(bool paused)` — Emergency pause
- `emergencyWithdraw(address token, uint256 amount)` — Withdraw stuck tokens

**Rate Limit Logic:**
- Daily cap resets at UTC midnight
- Tracks `dailyUsed` per chain
- Validates `maxHarvestPerTx` (single transaction cap)

### 6.4 LossHarvestVault.sol

**Source:** `contracts/src/LossHarvestVault.sol` (276 lines)

The vault that executes the actual token swap, taking a 5% (configurable) fee on harvested savings.

**Flow:**
1. Agent deposits harvested tokens to vault (via user's delegated permission)
2. Vault approves DEX router (Uniswap V3 SwapRouter)
3. Vault executes swap via DEX aggregator call data
4. Vault calculates fee (`feeBps` / 10000)
5. Sends fee to `feeRecipient` (TaxFi protocol)
6. Sends USDC to user
7. Records harvest in onchain history

**Key Functions:**
- `executeHarvest(user, tokenSold, amountSold, minUsdcOut, swapData, harvestId)` — Execute swap with slippage protection
- `authorizeAgent(address agent, bool authorized)` — Whitelist authorized agents
- `updateConfig(usdcToken, swapRouter, swapFee, feeRecipient, feeBps)` — Update configuration (owner only)
- `getUserHarvests(address user)` — Get all harvest history for a user
- `calculateEstimatedSavings(address user, uint256 shortTermRate)` — Estimate tax savings

**Safety Features:**
- **Reentrancy guard** via `nonReentrant` modifier
- **Slippage protection** via `minUsdcOut`
- **Uniswap pool fee tier** configurable via `swapFee`
- **Fee capped** at 10000 bps (100%) via constructor check

### 6.5 TaxFormAttestor.sol

**Source:** `contracts/src/TaxFormAttestor.sol` (193 lines)

Anchors document hashes onchain for an immutable audit trail of tax filings.

**Form Types:** `FORM_8949`, `SCHEDULE_D`, `SCHEDULE_1`, `SCHEDULE_C`, `FORM_1099_DA`

**Key Features:**
- **Year-to-year chaining** — Each attestation links to the previous year's hash
- **Duplicate prevention** — Cannot re-attest the same user/formType/taxYear
- **Verification** — Users or CPAs can verify attestations
- **Authorized signers** — Only TaxFi agent can attest

**Key Functions:**
- `attestForm(user, formType, taxYear, documentHash, ipfsCid)` — Anchor a form hash onchain
- `verifyAttestation(attestationId)` — Mark an attestation as verified (user/CPA)
- `getUserAttestations(address user)` — Get all attestations for a user
- `verifyDocument(attestationId, documentHash)` — Verify document matches onchain hash
- `getFilingChain(address user)` — Get entire filing history chain

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS |
| **State Management** | React Context (`useTaxFi`), TanStack React Query |
| **Wallet Connection** | RainbowKit + Wagmi v2, MetaMask SDK, MetaMask Smart Accounts Kit |
| **Blockchain Data** | Viem |
| **Styling/UI** | Framer Motion, GSAP, Radix UI, Lucide Icons, Recharts, Canvas Confetti |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Async HTTP** | aiohttp |
| **Database** | SQLite (dev) via aiosqlite, PostgreSQL (prod) via asyncpg |
| **Auth** | JWT (PyJWT), static API key, rate limiting via slowapi |
| **Metrics** | Prometheus client (request count, latency, in-flight, error rates) |
| **Logging** | Structlog (JSON-structured) |
| **Smart Contracts** | Solidity ^0.8.20, Hardhat, TypeScript |
| **Smart Account Kit** | MetaMask Smart Accounts Kit (EIP-7702, ERC-7715) |
| **Gasless Relayer** | 1Shot API (ERC-7710 delegated transactions) |
| **AI** | Venice AI API (chat completions with structured JSON output) |
| **CI/CD** | GitHub Actions (Ruff lint, ESLint, pytest, Hardhat test, Next.js build) |
| **Deployment** | Docker, Docker Compose v2, Traefik v3 (reverse proxy + TLS), nginx |

---

## 8. Frontend Pages

| Route | Page | Features |
|---|---|---|
| `/` | Landing | Hero, Stats, HowItWorks, Features, Comparison, Pricing, Security, FAQ, CTA, Footer |
| `/dashboard` | Dashboard | Stats grid (opportunities, harvestable losses, tax savings), charts (area + donut), quick actions, WebSocket live indicator |
| `/portfolio` | Portfolio | Stats grid (acquisitions, disposals, net gain/loss), bar chart (realized gains/losses), tabs (Overview, Open Lots), portfolio table, detail modal, chain filter |
| `/harvest` | Harvest | Stats grid (opportunities, harvestable loss, savings), filter pills (All/Ethereum/Base/Arbitrum), harvest cards with execute button, info box, toast notifications |
| `/reports` | Reports | Year selector, generate button, summary cards (net gain, income, tax owed, savings), form cards (8949, Schedule D, Schedule 1, Summary), onchain attestation display |
| `/permissions` | Permissions | 3-step flow (intro → signing → granted), configure scope (read-only/harvest/max daily/chains), trust summary, MetaMask permission request |
| `/settings` | Settings | Cost basis method selector (HIFO/FIFO/LIFO/ACB), harvest threshold, auto-execute toggle, notifications, account info, danger zone |

### Custom Hooks

| Hook | File | Purpose |
|---|---|---|
| `useTaxFi` | Context provider | Main state management (opportunities, ledgers, pipeline status) |
| `useTaxFiApi` | React Query wrappers | `usePipelineStatus`, `useRunPipeline`, `useOpportunities`, `usePortfolio`, `useGenerateForms`, `useDashboardData`, `useUpdateConfig` |
| `useMetaMaskPermissions` | ERC-7715 management | `checkPermissions`, `requestHarvestPermission`, `getGrantedExecutionPermissions`, `reset` |

### Shared Components

**Layout:** `PageHeader`, `TabBar`, `FilterPills`, `EmptyState`, `DetailModal`, `Toast`, `ErrorBoundary`, `LenisProvider`

**Animations:** `ScrollReveal`, `ParticleField`, `TextReveal`, `MagneticButton`, `LiquidButton`, `HolographicCard`, `ParallaxCard`, `StaggerReveal`, `ScrollProgress`, `TiltCard`

**Charts:** `MetricCard`, `StatCard`, `Sparkline`, `TaxChart`, `DonutChart`, `ProgressRing`

---

## 9. Backend API

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root API info |
| `GET` | `/health` | Server health + circuit breaker status |
| `GET` | `/config` | Runtime configuration |
| `GET` | `/metrics` | Prometheus metrics |
| `POST` | `/auth/login` | Exchange wallet address for JWT |
| `POST` | `/users` | Register a user wallet |
| `GET` | `/users` | List all users |
| `GET` | `/users/{address}` | Get user details |
| `DELETE` | `/users/{address}` | Delete user |
| `POST` | `/pipeline/run` | Trigger full pipeline (background task) |
| `GET` | `/pipeline/status` | Pipeline running status |
| `GET` | `/pipeline/runs` | Pipeline run history |
| `GET` | `/opportunities` | Harvest opportunities from last run |
| `GET` | `/opportunities/pending` | Pending opportunities from DB |
| `GET` | `/opportunities/executed` | Executed opportunities |
| `POST` | `/opportunities/{index}/execute` | Execute a harvest |
| `POST` | `/forms` | Generate IRS tax forms |
| `GET` | `/ledgers` | Cost basis ledgers |
| `GET` | `/ledgers/{asset}` | Ledger for specific asset |
| `GET` | `/lots` | Open acquisition lots |
| `POST` | `/continuous/start` | Start background continuous scanning |
| `POST` | `/continuous/stop` | Stop continuous scanning |
| `GET` | `/continuous/status` | Check if continuous mode is active |
| `PATCH` | `/settings` | Update runtime settings |
| `GET` | `/database/export/{address}` | Export user data snapshot |
| `WS` | `/ws` | Real-time event WebSocket |

### Middleware Stack

| Middleware | Purpose |
|---|---|
| `RequestIDMiddleware` | UUID per request for distributed tracing |
| `StructuredLoggingMiddleware` | JSON logging via structlog |
| `PrometheusMiddleware` | Request count, latency, in-flight, errors |
| `JWTAuthMiddleware` | JWT Bearer token or static API key verification |
| `Rate Limiting` | 100 req/min per IP via slowapi |

---

## 10. Environment Variables

### API Keys

| Variable | Required | Description |
|---|---|---|
| `VENICE_API_KEY` | ✅ | Venice AI API key for transaction classification |
| `VENICE_INFERENCE_KEY` | ⚠️ | Venice AI inference key (same as API key in dev) |
| `COVALENT_API_KEY` | ⚠️ | Covalent API key (or use Alchemy) |
| `ALCHEMY_API_KEY` | ⚠️ | Alchemy API key (or use Covalent) |
| `1SHOT_API_KEY` | ⚠️ | 1Shot API key for gasless relayer (for relayer submit) |
| `X402_WALLET_KEY` | ⚠️ | Wallet private key for x402 payment protocol |

### Smart Contract Addresses (Sepolia)

| Variable | Value | Description |
|---|---|---|
| `TAXFI_PERMISSION_REGISTRY` | `0x4F7141763FeB5dB91178343d3c894E88992794A3` | ERC-7715 permission registry |
| `TAXFI_AGENT_ADDRESS` | `0x401E5B592D1F56f335405079F13d49b81309f82f` | Agent smart account |
| `TAXFI_VAULT_ADDRESS` | `0x2AF710af85914DEe0AA89017223638367645f6b4` | Loss harvest vault |
| `TAXFI_ATTESTOR_ADDRESS` | `0xff32FDd41F06b1a166d56677d1C5c0001251BF4C` | Form attestor |
| `TAXFI_AGENT_OWNER` | `0x5aB3036C7d0bA7043E0BB531374dC6c732eC4954` | Agent owner EOA |
| `TAXFI_USDC_ADDRESS` | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | USDC on Sepolia |
| `TAXFI_UNISWAP_ROUTER` | `0xb41b78Ce3D1BDEDE48A3d303eD2564F6d1F6fff0` | Uniswap V3 router |
| `TAXFI_CHAIN_ID` | `11155111` | Sepolia chain ID |

### Auth & Security

| Variable | Default | Description |
|---|---|---|
| `TAXFI_JWT_SECRET` | — | JWT signing secret (required in production) |
| `TAXFI_JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `TAXFI_AUTH_DISABLED` | `false` | Disable JWT auth for local dev |
| `TAXFI_API_KEY` | — | Static API key for simple auth |
| `TAXFI_RATE_LIMIT` | `100/minute` | Rate limit string |

### Configuration

| Variable | Default | Description |
|---|---|---|
| `TAXFI_COST_BASIS_METHOD` | `HIFO` | Cost basis calculation method |
| `TAXFI_HARVEST_THRESHOLD` | `100.0` | Minimum harvest value in USD |
| `TAXFI_SCAN_INTERVAL` | `3600` | Pipeline scan interval in seconds |
| `TAXFI_SUPPORTED_CHAINS` | `eip155:1,eip155:8453,eip155:42161` | Chains to scan |
| `TAXFI_AGENT_FEE_BPS` | `500` | Agent fee in basis points (500 = 5%) |
| `TAXFI_DB_TYPE` | `sqlite` | Database backend type |
| `TAXFI_DB_PATH` | `~/.taxfi/taxfi.db` | SQLite database path |
| `TAXFI_PG_DSN` | — | PostgreSQL connection string |
| `TAXFI_FORM_DEV_MODE` | `false` | Dev mode gating for form generation |
| `TAXFI_SHORT_TERM_RATE` | `0.22` | Short-term capital gains tax rate |
| `TAXFI_LONG_TERM_RATE` | `0.15` | Long-term capital gains tax rate |
| `TAXFI_BACKUP_RETENTION_DAYS` | `7` | Database backup retention |

### Frontend

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect Project ID |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (derived from API URL) |

---

## 11. Getting Started

### Prerequisites

- **Python 3.11+** (backend)
- **Node.js 20+** and **pnpm** (frontend)
- **Docker + Docker Compose v2** (production deployment)
- **API keys**: Venice AI, Covalent (or Alchemy), WalletConnect Project ID, 1Shot API Key

### Backend

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
export VENICE_API_KEY="your-venice-key"
export COVALENT_API_KEY="your-covalent-key"
python -m backend.api
```

### Frontend

```bash
cd frontend
pnpm install
export NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="your-project-id"
pnpm dev
```

### Smart Contracts

```bash
cd contracts
npm install
npx hardhat test
npx hardhat compile
```

### Test

```bash
PYTHONPATH=. TAXFI_FORM_DEV_MODE=true python3 -m pytest tests/ -q
```

---

## 12. Production Deployment

### Docker Compose

```bash
cp .env.example .env
# Edit .env with your domain and API keys
bash deployment/setup.sh
docker compose up --build -d                           # SQLite
docker compose --profile postgres up --build -d        # PostgreSQL
docker compose --profile backup up --build -d          # + daily backups
```

Your app will be available at `https://${DOMAIN}` with automatic TLS (Let's Encrypt via Traefik).

### Monitoring

- **Health check**: `https://${DOMAIN}/api/health`
- **API docs**: `https://${DOMAIN}/docs`
- **Prometheus metrics**: `https://${DOMAIN}/api/metrics`
- **Traefik logs**: `docker compose logs traefik`

---

## 13. Security

- **Non-custodial**: ERC-7715 read-only + periodic spend permissions. Users never give up wallet control
- **JWT auth**: Token-based auth with 24h expiry. Production requires explicit `TAXFI_JWT_SECRET`
- **Rate limited**: 100 requests/minute per IP via slowapi backend + Traefik edge proxy
- **Headers**: CSP, HSTS (1 year, preload), frameDeny, nosniff, XSS filter, referrer policy
- **TLS**: Automatic Let's Encrypt certificates via Traefik ACME
- **x402 payments**: Verification checks facilitator + onchain receipts (no blind trust)
- **Circuit breakers**: Per-service circuit breakers for Venice AI, Covalent, 1Shot — prevents cascading failures
- **Reentrancy guard**: `LossHarvestVault` uses `nonReentrant` modifier
- **Slippage protection**: `minUsdcOut` parameter in harvest execution
- **Permission replay protection**: `usedPermissions` mapping in `TaxFiAgentSmartAccount`
- **Backup retention**: Automated daily SQLite backups with configurable retention + optional S3 off-site

---

## Project Structure

```
taxfi/
├── backend/                   # FastAPI backend (multi-agent pipeline)
│   ├── api.py                # REST + WebSocket API server
│   ├── taxfi.py              # Orchestrator agent
│   ├── config.py             # Configuration management
│   ├── database*.py          # Database layer (SQLite + PostgreSQL)
│   ├── auth_middleware.py    # JWT + API key authentication
│   ├── agents/               # Specialized agents
│   │   ├── ingest_agent.py   # Transaction data ingestion
│   │   ├── classifier_agent.py  # Venice AI classification
│   │   ├── basis_agent.py    # Cost basis calculation
│   │   ├── loss_detector.py  # Tax loss harvesting detection
│   │   ├── form_generator.py # IRS form generation
│   │   └── executor_agent.py # 1Shot relayer execution
│   ├── integrations/         # External API integrations
│   │   ├── venice.py         # Venice AI (classification + analysis)
│   │   ├── x402.py           # x402 payment protocol
│   │   └── oneshot.py        # 1Shot relayer (ERC-7710)
│   └── utils/                # Helpers (monitoring, retry, etc.)
├── frontend/                  # Next.js 15 app
│   └── src/
│       ├── app/              # Pages (dashboard, portfolio, harvest, etc.)
│       ├── components/       # UI components (60+ shared + page-specific)
│       ├── hooks/            # React hooks
│       │   ├── useTaxFi.tsx           # Main state management context
│       │   ├── useTaxFiApi.ts         # TanStack React Query wrappers
│       │   └── useMetaMaskPermissions.ts  # ERC-7715 permissions
│       └── utils/            # API client, permission types
├── contracts/                 # Solidity smart contracts (Hardhat)
│   ├── src/                  # Contract source files
│   │   ├── AgentPermissionRegistry.sol   # ERC-7715 registry
│   │   ├── TaxFiAgentSmartAccount.sol    # Agent smart account
│   │   ├── LossHarvestVault.sol          # Harvest vault
│   │   └── TaxFormAttestor.sol           # Form attestor
│   ├── test/                 # Hardhat tests
│   └── scripts/              # Deployment scripts
├── deployment/               # Production deployment configs
│   ├── traefik.yml           # Traefik v3 static config
│   ├── nginx.conf            # nginx for dev/fallback
│   ├── setup.sh              # ACME setup script
│   └── backup.sh             # Database backup script
├── tests/                    # Backend tests (pytest)
└── .github/workflows/        # CI/CD pipeline
```

---

## License

MIT — see [LICENSE](LICENSE.md)

## Team

Built for the **MetaMask Smart Accounts Kit × 1Shot API × Venice AI Dev Cook Off**.

Contact: team@taxfi.xyz
