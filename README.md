# Unicity Paid Service Agent

A DM-native paid service agent for Unicity testnet.

Users can:

- send a DM to the agent
- request a service
- receive a quote
- accept the quote
- pay through a Unicity payment request
- receive the result back over DM

This project is a strong fit for the Unicity Builder Program because it is:

- `agentic`
- payment-enabled
- easy to demo live
- easy to extend into a richer autonomous service agent

## Live Agent

- nametag: `@encoderagent`
- network: `testnet`

## Services

- `summarize`
- `rewrite`
- `keywords`
- `title`

## DM Commands

- `catalog`
- `help`
- `balance`
- `jobs`
- `quote summarize | your text here`
- `quote rewrite | your text here`
- `quote keywords | your text here`
- `quote title | your text here`
- `accept <jobId>`
- `status <jobId>`

## Demo Flow

1. DM `catalog` to `@encoderagent`
2. Send `quote summarize | ...`
3. Receive a quote and `jobId`
4. Send `accept <jobId>`
5. Pay the payment request
6. Ask for `status <jobId>` or wait for the result DM

## Local Test Helpers

DM test:

```bash
npm run test:dm -- @encoderagent catalog
```

Top up the local test wallet without a separate faucet:

```bash
npm run test:topup -- 1
npm run test:topup -- 0.1
```

View or pay pending payment requests:

```bash
npm run test:pay
npm run test:pay -- <requestId>
```

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

## Environment

- `SPHERE_NAMETAG`: optional, but recommended for a public-facing agent
- `AUTHORIZED_SENDERS`: leave empty to keep the agent open
- `SERVICE_COIN_ID`: service payment coin, default `UCT`
- `QUOTE_EXPIRY_MINUTES`: quote lifetime
- `SPHERE_TEST_*`: settings for the local test wallet helpers

## Architecture

- `src/index.ts`: main agent runtime, DM handling, payment-request flow
- `src/jobStore.ts`: persistent quote/job storage
- `src/services.ts`: service logic and pricing
- `src/test-dm.ts`: local DM tester
- `src/test-pay.ts`: local payment-request helper
- `src/test-topup.ts`: local test-wallet topup helper

## Why This Build Is Strong

- clear user-facing flow
- uses Unicity DM plus payment requests together
- easy to show in a short demo
- can be expanded with LLM services, escrow, invoices, or autonomous negotiations

## References

- [Sphere SDK](https://github.com/unicity-sphere/sphere-sdk)
- [Sphere CLI](https://github.com/unicity-sphere/sphere-cli)
- [Node.js Quickstart](https://github.com/unicity-sphere/sphere-sdk/blob/main/docs/QUICKSTART-NODEJS.md)
