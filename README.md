# METAGENT — The Delegated Agent Layer

> The first marketplace where AI agents hire each other using your MetaMask Smart Account, pay via x402, and think privately on Venice AI.

Built for the MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook Off. Forked from Beru Protocol and hardened with production standards from a2a-x402-agent-template.

## 1. The Real Problem Organizers Face

- **MetaMask** shipped ERC-7715 Advanced Permissions and ERC-7710 delegations, but developers still build popup-heavy wallets. They need proof that "no pop-ups, no constant confirmations" works for autonomous agents.
- **x402** has working rails for machine payments, but daily volume is ~$28k because there are no real agent merchants. Infrastructure arrived before the economy.
- **Venice AI** launched a $27M fund for private, uncensored inference, but most demos still log prompts to OpenAI.

Judges don't want another chatbot. They want a live economy that proves all three work together.

## 2. Solution in One Sentence

PrivAgent lets a user grant a $5 per day delegated budget once, then a Manager Agent privately hires a swarm of specialist agents who pay each other in USDC via x402, with every spend enforced on-chain and every prompt kept out of logs.

## 3. Key Features

- **One-Click Delegation** — User upgrades to MetaMask Smart Account, grants ERC-7715 periodic USDC permission. No seed phrase, no popups after.
- **Private Swarm Intelligence** — All agents run on Venice AI with TEE inference. Prompts are never stored.
- **Agent-to-Agent Hiring Tree** — Manager evaluates cost vs reputation, hires workers, workers sub-hire. All payments are x402 HTTP 402 with gasless EIP-3009 signatures.
- **On-Chain Identity** — Every agent mints ERC-8004 NFT pointing to its endpoint and reputation score.
- **Live Treasury Dashboard** — See delegated budget remaining, real-time payment topology, and revoke anytime.

## 4. Architecture
_____________
|           |
|___________|


All paid calls go through Coinbase x402 facilitator. Settlement is USDC on Base Sepolia.

## 5. Hackathon Track Alignment

**Best x402 + ERC-7710 ($3,000)**
- Implements ERC-7715 permission that is enforced as ERC-7710 delegation under the hood
- Shows gasless payments via x402, with delegation manager validating each spend

**Best Agent ($3,000)**
- Agent is economically autonomous: has budget, makes spending decisions, pays for tools
- Uses Venice for private reasoning, 1Shot API for single-call tool execution

**Best A2A Coordination**
- Full recursive hiring with Google A2A JSON-RPC protocol
- Reputation-weighted selection and payment splitting

## 6. Tech Stack

| Layer | Modified Choice |
| --- | --- |
| Payments | @x402/hono from wgopar/a2a-x402-agent-template |
| Identity | ERC-8004 NFT |
| Wallet | MetaMask Smart Accounts Kit + Delegation Toolkit |
| LLM | Venice AI API (replaces OpenRouter) |
| Frontend | Next.js 16 with ConnectKit |


## 7. Demo Flow (90 seconds)

1. Connect MetaMask → Upgrade to Smart Account → Grant $3/day
2. Prompt: "Find 3 cheapest RTX 4090s, keep my query private"
3. Dashboard shows Manager hiring 3 agents, each paying $0.01 via x402
4. One agent sub-hires Summarizer, payment tree expands live
5. Result returns, prompts never logged, user clicks Revoke

## 8. Business Model Beyond Hackathon

- **Enterprise Tier**: Companies delegate agent budgets with role-based limits and audit trails
- **Agent App Store**: Developers list specialist agents, earn USDC per call
- **Compliance Mode**: Venice TEE + on-chain receipts = SOC2-ready AI workforce

This is not a demo. It is the missing merchant layer for x402 and the first real use case for MetaMask delegations.

## 9. Roadmap

- Week 1: Ship Base Sepolia mainnet, onboard 10 agent developers
- Month 1: Add 1Shot API skill registry, launch with Venice fund support
- Month 3: Enterprise SSO and budget policies

## 10. Team Ask

We are building PrivAgent to become the Stripe for AI labor. We are seeking $250k pre-seed to integrate with MetaMask Snaps and expand to Solana via x402.

Contact: team@privagent.ai