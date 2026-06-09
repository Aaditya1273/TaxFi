Crypto Tax 101 + TaxFi Full Spec
Part 1: Crypto Tax — Why It's a Nightmare

Before the spec, let me give you the foundation, because the product only works if the pain is real.
How the IRS treats crypto

The IRS declared in Notice 2014-21 that cryptocurrency is property, not currency. This means every "disposal" is a taxable event, just like selling stock.
What's a taxable event
Event	Taxable?
Buying ETH with USD	❌ No (just an acquisition)
ETH → USDC swap	✅ Yes (disposal of ETH)
ETH → NFT	✅ Yes
Buying coffee with USDC	✅ Yes
Receiving staking rewards	✅ Yes (ordinary income at FMV)
Receiving an airdrop	✅ Yes (ordinary income at FMV)
Transferring between your own wallets	❌ No
Holding	❌ No (only when you sell)
Donating to 501(c)(3)	❌ No (deductible)
The forms you need

    Form 8949 — line by line, every single disposal. Tedious.
    Schedule D — summary of capital gains/losses
    Schedule 1 — staking/mining/airdrop income
    Schedule C — if you trade as a business
    Form 1099-DA — new in 2025, brokers must report

Short-term vs long-term

    Short-term (held < 1 year) = taxed as ordinary income (10–37%)
    Long-term (held > 1 year) = taxed at capital gains rates (0/15/20%)
    The 1-year boundary is a HUGE deal — knowing when to hold vs sell is a tax optimization

Cost basis methods (this is where it gets wild)

When you sell 1 ETH, the IRS needs to know which ETH you sold:

    FIFO (First In, First Out) — sell oldest coin
    LIFO (Last In, First Out) — sell newest coin
    HIFO (Highest In, First Out) — the tax king, sells highest basis first, minimizes gains
    Specific ID — pick exact lot (requires perfect records)

Most tools default to FIFO. Most people overpay taxes by thousands because they don't know to switch to HIFO.
Why DeFi is a tax horror

Every "simple" DeFi action can be 3+ taxable events:

    Adding liquidity to Uniswap = disposal of both tokens → taxable swap
    LP rewards = ordinary income at FMV
    Removing liquidity = disposal of LP token + underlying
    Yield farming harvest = income
    Compounding = often treated as a swap
    Bridges (ETH → Arbitrum) = arguably a taxable event (still disputed)
    Impermanent loss = no specific guidance from IRS, every tool handles differently

A single yield farmer can have 30,000+ events per year. No human can do this manually.
The killer feature: tax loss harvesting

If you have positions at a loss, you can:

    1.Sell them → realize the loss
    2.Use the loss to offset gains
    3.Deduct up to $3,000/year against ordinary income
    4.Carry forward unused losses indefinitely

And in crypto, there's currently NO wash sale rule (the IRS proposed closing it). So you can sell a losing position and immediately rebuy. Active traders can save tens of thousands per year.

Most users have no idea. They just hold the losers and overpay. This is the money on the table for our agent.
The pain today (existing tools)
Tool	Cost	Pain
CoinTracker	$50–199/yr	Subscription, manual fixes, no optimization
Koinly	$49–999/yr	Subscription, year-end only, no real-time
ZenLedger	$49–399/yr	Subscription, manual classification
TokenTax	$65–3,500/yr	Expensive, CPA-tier
TaxBit	Enterprise	B2B only
DIY Excel	Free	Impossible past 100 transactions

Common complaints across all of them:

    "Why am I paying $200/yr for software that misses 20% of my DeFi events?"
    "It classified my LP entry wrong and I got a notice from the IRS"
    "I just want someone to tell me how to pay the LEAST in taxes, not just FILE"

That last line is the wedge. TaxFi isn't a tax filer. It's a tax optimizer that uses the agentic stack to find and execute savings the user didn't know existed.
TaxFi — Full Product Spec
The pitch

"Your crypto tax agent that pays for itself."

User grants read-only Smart Account permission. Multi-agent pipeline scans every wallet across every chain, classifies every transaction with Venice AI, finds the optimal cost basis method, identifies tax loss harvesting opportunities, and either files the IRS form or hands it to your CPA. Free if you don't save anything. 5% of tax savings if you do.
Why this wins the market (not just the hackathon)

    CoinTracker/Koinly are subscription-based — user pays regardless of value
    None of them are agentic — they run once at year-end
    None of them optimize — they just file
    None of them execute — they don't actually harvest the losses
    None of them are non-custodial — they hold your data on their servers
    None of them are gasless — still requires ETH for the user

TaxFi is the only one that's non-custodial, agentic, real-time, optimizing, executing, AND gasless. The "agent pays for itself" model is the wedge.
User personas
Persona	Goal	Pain today
Riya — Active DeFi user	800 txns/year across 3 chains, $50k+ gains	Spent $200 on Koinly, still got a "we classified 200 events wrong" email
Marcus — Yield farmer	30,000 txns/year, multiple wallets, LP-heavy	Paid $1,500 to a CPA, still not sure it's right
Diana — NFT trader	Taxed 28% (collectibles rate), no idea	Thinks NFTs are tax-free in many cases (wrong)
Ben — Crypto dev	Hacked once, lost cost basis records	Stuck paying full tax on disposals because he can't prove basis
Jia — DAO contributor	Gets paid in stables, airdrops, vesting tokens	Has no idea how to handle token vesting for tax
Core user flows
Flow A — Onboarding (60 seconds)

    1.User visits taxfi.xyz, connects wallet (MetaMask, Rainbow, etc.)
    2.Smart Account auto-created (or upgraded via EIP-7702)
    3.User signs Advanced Permission (ERC-7715) — read-only, scoped, time-bounded:
    text

    Permission: "TaxFi agent can READ all transactions on these 5 addresses
                 across Ethereum, Base, Arbitrum for 365 days.
                 CANNOT move funds, CANNOT sign transactions, CANNOT modify
                 wallet state. READ-ONLY."

    4.User picks cost basis method (default: HIFO, since it's tax-optimal)
    5.User picks jurisdiction (US-only for MVP)
    6.Onboarding done. Agent starts scanning.

Flow B — Real-time monitoring (the agentic part)

This is where TaxFi diverges from every competitor. The agent runs continuously, not just at year-end.

    Every new transaction the user makes → Ingest Agent picks it up via Covalent webhook
    Classifier Agent (Venice) categorizes: swap / airdrop / staking / LP / transfer
    Basis Agent updates cost basis ledger
    Loss Detector Agent (Venice) checks: "is this a harvestable loss right now?"
    If harvest opportunity found → push notification to user:

        "💡 You have $4,200 in harvestable losses in your wallet. ETH down 18% from your entry. Tap to harvest — gas paid in USDC, net savings ~$4,200."

Flow C — Loss harvesting (the killer feature)

    1.User taps "harvest" in the app
    2.Risk Manager Agent checks: would this trigger wash sale? (forward-compatible with proposed IRS rule)
    3.Executor Agent prepares the swap(s) on the user's Smart Account
    4.Approver Agent checks: harvest amount > $1,000? If so, ask user; if no, auto-execute
    5.1Shot relays the transaction — gas paid in USDC
    6.User gets USDC + realizes the loss + can immediately rebuy
    7.Agent takes 5% of the saved tax amount

Flow D — Year-end filing

    1.Form Generator Agent produces:
        Form 8949 (PDF, IRS-compliant layout)
        Schedule D (auto-filled)
        Schedule 1 (for staking/airdrop income)
        Plain-English summary: "You made $47,200 in short-term gains, $12,300 in long-term gains, harvested $4,200 in losses. Federal tax owed: ~$8,800."
    2.Filing Agent offers three options:
        Download PDF → user files themselves
        Send to TurboTax API → one-click import
        CPA partner → $99 CPA review + e-file
    3.Onchain attestation — the form's hash is anchored onchain via 1Shot, gives the user an immutable audit trail

Flow E — Year-round tax estimator

User opens the app anytime and sees:

    YTD realized gains
    Unrealized gains (live market prices)
    Estimated tax bill if they sold everything today
    "What if I sold just ETH?" calculator
    "Should I hold until 1-year mark for long-term rates?" reminders

🦊 MetaMask Smart Accounts Kit — Deep Dive
What's used
Component	Role in TaxFi
Smart Accounts	One per user, holds USDC for fees + loss harvesting, receives harvested proceeds
EIP-7702	First-time MetaMask users get upgraded to Smart Account on first connect
Advanced Permissions (ERC-7715)	The read-only permission grant — the entire trust model rests on this
Delegation Framework (ERC-7710)	Agent uses 7710 to execute loss-harvesting transactions within permission scope
Gator SDK	Manages permission lifecycle (request → grant → check → revoke)
Session Keys	Agent's session key for routine operations, time-bounded
The permission grant — the literal killer feature
solidity

// Simplified representation
permission = {
  granter: userSmartAccount,
  grantee: taxFiAgentSmartAccount,
  scope: {
    chains: [ETHEREUM, BASE, ARBITRUM],
    addresses: [userAddr1, userAddr2, ...],
    operations: [READ_ONLY],          // cannot sign or move funds
    methods: [
      "eth_call",
      "eth_getTransactionReceipt",
      "covalent_getTransactions",
      "covalent_getTokenBalances"
    ]
  },
  duration: 365 days,
  revokeable: true,
  valueLimit: 0                       // absolutely cannot move value
}

This is the non-custodial trust model. The user doesn't have to trust TaxFi. The smart contract enforces: agent can only read.
What the user actually signs

In the wallet UI, the user sees:

    🛡️ TaxFi Permission Request

    TaxFi is requesting read-only access to:

        0x1234…5678 on Ethereum
        0x9abc…def0 on Base
        0x5555…aaaa on Arbitrum

    ✅ Can: read your transaction history, balances, token transfers ❌ Cannot: move funds, sign transactions, modify your wallet

    Expires: June 6, 2027 [Reject] [Approve]

This is the opposite of a blind signature. The user sees exactly what they're granting.
Loss harvesting authority — the explicit second permission

For loss harvesting, the user signs a second, separate, more permissive permission:
text

Permission: "TaxFi agent can execute swaps of up to $10,000/day
             on these 3 addresses, ONLY when harvest conditions met,
             ONLY to/from USDC, ONLY when user has approved via push
             notification within last 5 minutes."

Two permissions. Two different risk levels. User can grant READ without granting HARVEST. This is the granular permission model that competitors can't match.
⛽ 1Shot Permissionless Relayer — Deep Dive
What 1Shot does here

    Relays all loss-harvesting swaps — user has 0 ETH, doesn't care
    Gas paid in USDC from the harvested proceeds
    Webhooks drive the app's real-time updates
    Public relayer = no signup, no business dev, no tier management
    7702 authorizations upgrade accounts to Smart Accounts through 1Shot — on first connect, the upgrade tx goes through 1Shot too

The "no ETH required" moment in the demo

    "This user is brand new. They have $0 ETH. They connect MetaMask. TaxFi needs to upgrade their EOA to a Smart Account via 7702 to even function. The upgrade tx is relayed through 1Shot. Gas is paid in USDC. They never have to think about gas. Ever."

This is the single most important UX moment in the product. It removes the #1 onboarding friction in Web3.
Bonus: stablecoin gas means the agent itself is gasless

The agent runs server-side, but when it executes on behalf of users, the gas is paid in stablecoins via 1Shot. This means:

    No need for the user to fund the agent
    No need for the user to bridge ETH
    The whole experience is "USDC in, USDC out"

🧠 Venice AI — Deep Dive

Venice is the reason TaxFi can handle weird DeFi events that other tools miss.
Use case 1: Transaction classification

The hardest problem in crypto tax. Every tool gets this wrong on edge cases.
python

prompt = f"""
Classify this transaction:
  from: {tx['from']}
  to: {tx['to']}
  method: {tx['method']}
  logs: {tx['logs']}
  token movements: {tx['transfers']}

Categories: SWAP, AIRDROP, STAKING_REWARD, LP_DEPOSIT, LP_WITHDRAW,
            BRIDGE, TRANSFER_SELF, MINT, BURN, NFT_BUY, NFT_SELL,
            YIELD_HARVEST, GOVERNANCE_CLAIM, OTHER

Return JSON: { category, confidence, reasoning, taxable, basis_method }
"""

Venice handles ambiguity that rule-based systems can't. Example: "is this 0x7ff36ab5 Beefy vault deposit or a generic ERC20 transfer?" — Venice reads the contract code + event signatures + token movements together.
Use case 2: Tax loss harvesting suggestions
python

prompt = f"""
User's portfolio:
{positions}

Market data:
{prices}

Tax situation:
  - Short-term gains realized YTD: {st_gains}
  - Long-term gains realized YTD: {lt_gains}
  - Carry-forward losses: {cf_losses}
  - User's ordinary income bracket: {bracket}

Identify tax loss harvesting opportunities:
- Which positions are at a loss?
- What's the optimal sale size to offset gains?
- Should we recommend specific ID to harvest losses?
- Is there a wash sale risk? (forward-compat)
- Estimated tax savings if harvested?
- Recommended rebuy token (different enough to avoid wash sale)?

Return: ranked list of harvest opportunities with $ saved
"""

Use case 3: Plain-English explanations
python

prompt = f"""
Explain to the user in 2 sentences why this transaction is taxable:
  {tx_summary}

Include: the IRS rule it falls under, and how it affects their tax.
"""

The user shouldn't need a CPA to understand why they owe what they owe. Venice generates the "your tax in plain English" view.
Why Venice (not OpenAI)

    Privacy — tax data is the most sensitive financial data there is. The user does NOT want OpenAI training on their wallet history.
    Cost — Venice is cheaper for high-volume classification (millions of transactions)
    Multi-modal — can read screenshots of exchange CSVs when users upload them

💸 x402 — Deep Dive

x402 has four killer use cases in TaxFi:
Use case 1: Pay-per-call data sources

When the Ingest Agent needs a real-time price for a token not in the free tier of CoinGecko, it pays via x402 to a premium oracle endpoint. No API key, no subscription, no rate limit dance.
Use case 2: x402 endpoint for OTHER agents

    "Hey TaxFi, I have a transaction I'm not sure how to classify. Can you look it up?"

A 402 request from another agent → pays $0.001 per lookup → gets the classification. TaxFi becomes a utility for the agentic economy. This is the A2A angle.
Use case 3: Filing fees

The user pays the IRS filing fee (or TurboTax e-file fee) via x402. Crypto on-ramp to fiat behind the scenes, user just sees "File for $14.99 in USDC."
Use case 4: Agent bounty for edge cases

If a transaction is unclassifiable, the agent posts a bounty via x402 to a network of human tax experts (or other agents) to resolve it. Payment automatic on accepted answer. AutoBounty and TaxFi are the same product from different angles.
🧩 Full architecture
text

┌────────────────────────────────────────────────────┐
│                  User's Wallets                     │
│         (read-only via ERC-7715 permission)         │
└────────────────────┬───────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│            Ingest Agent (Covalent/Alchemy)          │
│  • Pulls all transactions across all chains         │
│  • Normalizes into canonical format                 │
└────────────────────┬───────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│              Classifier Agent (Venice)              │
│  • Categorizes every event                          │
│  • Handles DeFi edge cases                          │
│  • Confidence scoring                               │
└────────────────────┬───────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│             Basis Agent + Loss Detector             │
│  • FIFO/LIFO/HIFO/SpecID                           │
│  • Continuous loss harvesting detection            │
└────────────────────┬───────────────────────────────┘
                     │
            ┌────────┴────────┐
            ▼                 ▼
   ┌──────────────────┐  ┌──────────────────┐
   │  Form Generator  │  │ Loss Harvester   │
   │  Agent (Venice)  │  │ Executor (1Shot) │
   └──────────────────┘  └──────────────────┘
            │                 │
            ▼                 ▼
   ┌──────────────────┐  ┌──────────────────┐
   │  IRS Form 8949   │  │  USDC received   │
   │  + Schedule D    │  │  in user wallet  │
   └──────────────────┘  └──────────────────┘

🧠 Smart contract architecture
text

UserSmartAccountFactory.sol
   └── deploys UserSmartAccount.sol (one per user, holds USDC)

UserSmartAccount.sol
   ├── holds: USDC balance
   ├── grants: AgentPermission (ERC-7715)
   ├── receives: harvested USDC, refund USDC
   └── owner: user (full control)

AgentPermissionRegistry.sol
   ├── stores: all granted permissions
   ├── validates: chain ID, address, scope, time
   └── supports: revoke by user

TaxFiAgentSmartAccount.sol (one per agent instance)
   ├── executes: loss harvesting swaps
   ├── validates: permission scope per call
   └── rate-limited: $X per day via Smart Account

LossHarvestVault.sol
   ├── receives: harvested tokens
   ├── swaps: to USDC via Uniswap/CowSwap
   └── sends: to UserSmartAccount

TaxFormAttestor.sol
   ├── anchors: Form 8949 hash onchain
   ├── verifies: agent + user signatures
   └── immutable audit trail for IRS

🚀 Market-ready extensions
Tier 1: Ship with MVP (3-day build)

    ✅ Read-only permission grant flow
    ✅ Multi-chain scan (Ethereum, Base, Arbitrum)
    ✅ Venice classification
    ✅ HIFO basis calculation
    ✅ Form 8949 + Schedule D PDF generation
    ✅ Tax loss harvesting with one-tap approval
    ✅ 1Shot gasless
    ✅ x402 for premium price feeds
    ✅ Web dashboard

Tier 2: Polish (1 week)

    🎨 Real-time push notifications ("you just got an airdrop worth $X")
    🎨 Mobile-responsive PWA
    🎨 CSV export for TurboTax/H&R Block direct import
    🎨 Multi-year ledger (carry-forward loss tracking)
    🎨 Onchain audit trail (form hashes + signatures)
    🎨 CPA collaboration portal (read-only link for accountant)
    🎨 Year-end reminder emails

Tier 3: Growth features (1 month)

    🚀 Multi-jurisdiction (UK, EU, Canada, Australia, Singapore)
    🚀 NFT support with collectibles rate detection
    🚀 Margin/futures support (dYdX, Hyperliquid, GMX)
    🚀 LP/Impermanent loss tracking (advanced DeFi)
    🚀 Cross-chain bridge detection (with IRS rule tracking)
    🚀 Year-round tax estimator
    🚀 "What if I sold?" calculator
    🚀 Slack/Discord/Telegram alerts
    🚀 Public API (let other tools integrate)
    🚀 x402 endpoint for other agents
    🚀 Mobile app (React Native)

Tier 4: Enterprise / moat (3 months)

    🏢 White-label for CPAs (manage 100s of clients)
    🏢 Token vesting module (handle unlock schedules, tax timing)
    🏢 DAO treasury module (multi-sig tax reporting)
    🏢 Form 1099-DA automation (broker reporting)
    🏢 Audit defense package (transaction-level evidence)
    🏢 Insurance (audit insurance if TaxFi makes a mistake)
    🏢 Integration with TurboTax/H&R Block (one-click)
    🏢 DeFi protocol partnerships (auto-share tax data from Uniswap, Aave, etc.)
    🏢 Wash sale forward-compat (when IRS closes the loophole)
    🏢 Multi-entity support (LLC, Corp, Trust, Foundation)

💰 Business model

Core insight: we're not a subscription product, we're a savings product. We only get paid when the user saves money. That's the entire wedge.
Tier	Price	What you get
Free	$0	1,000 txns, US only, basic Form 8949, no optimization
Trader	5% of tax savings	Unlimited, all features, all jurisdictions, real-time monitoring, loss harvesting
Pro (annual)	$299/yr	Unlimited everything, priority CPA review, audit insurance
CPA/Enterprise	$99/client/mo	White-label, multi-client management, bulk export
Agent API	$0.10/lookup	x402 endpoint for other agents to query classifications
Data licensing	B2B	Aggregated anonymized tax data for research (e.g., "how much did US crypto users pay in 2024?")

The killer number: 100k active users × $200 avg tax savings × 5% = $1M/year from one cohort.

Market size: 50M+ US crypto users, ~10M file taxes, ~$300/yr avg paid to existing tools = $3B market. We take 5% of Xinsavings,notY in subscription fees. Different unit economics entirely.
🏆 Competitive positioning
	TaxFi	CoinTracker	Koinly	TokenTax
Non-custodial	✅	❌	❌	❌
Agentic / real-time	✅	❌	❌	❌
Gasless	✅ (1Shot)	N/A	N/A	N/A
AI reasoning	✅ (Venice)	Partial	❌	❌
Bounded permissions	✅ (ERC-7715)	❌	❌	❌
Tax loss harvesting	✅	❌	❌	❌
x402 endpoint	✅	❌	❌	❌
Pay only on savings	✅	❌	❌	❌
Onchain audit trail	✅	❌	❌	❌
Privacy-first AI	✅ (Venice)	❌	❌	❌
🎬 The 3-minute demo script

    [0:00] Hook: "Americans paid $20B+ in crypto taxes last year. Most of them overpaid by thousands. We built TaxFi — the agent that finds what you shouldn't have paid, and harvests it back for you."

    [0:30] The setup: Show a wallet with 12,000 transactions across Ethereum, Base, Arbitrum. "Watch this."

    [1:00] The permission grant: User signs read-only ERC-7715 permission. UI: "✅ Read-only. ❌ Cannot move funds. ❌ Cannot sign." User never gives up custody.

    [1:30] The agent runs: "Ingest agent pulling from Covalent… Classifier agent categorizing with Venice… Basis agent calculating HIFO… 12,000 transactions in 8 seconds."

    [2:00] The reveal: "Found $4,200 in harvestable losses. ETH down 18% from your cost basis. Tap to harvest." User taps. 1Shot relayer executes. Gas paid in USDC. User had 0 ETH.

    [2:30] The close: "Tax saved: $4,200. Agent fee: $210. Net to you: $3,990. The agent paid for itself. And here's your Form 8949, anchored onchain. IRS-ready. CPA-friendly. End of year."

🎯 Hackathon prize breakdown
Track	How we hit it
Best Agent ($3k)	Multi-agent pipeline is the entire product — 4 agents visible in the demo
x402 + ERC-7710 ($3k)	ERC-7715 permission is the trust model; x402 for data + filing fees
1Shot Relayer ($1k)	Every loss harvest is gasless in USDC, even the EIP-7702 account upgrade is relayed
Venice AI ($3k, needs main track eligibility)	Classification, optimization, explanations — three Venice calls per scan
A2A coordination (potential)	x402 endpoint lets other agents query TaxFi — agent-to-agent queries
Social ($100)	"I made my tax agent pay for itself" is the tweet

Conservative: $7k. Stretch: $10k+ with Venice and A2A.
Why this could be a real company

    Strong wedge: "agent pays for itself" is a story that markets itself
    Massive market: every crypto user is a potential user
    Multiple monetization paths: subscription + % of savings + B2B + data + API
    Strong moat: the more agents query it, the better its classifications get (network effect)
    Crypto-native brand: aligns with the future of work, ownership, and money
    Composability: x402 endpoint makes it a primitive other apps build on