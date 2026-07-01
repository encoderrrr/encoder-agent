# Unicity Builder Submission Guide

This file is the final checklist for submitting the project.

## Current Submission State

- project type: `paid service agent`
- network: `testnet`
- live agent nametag: `@encoderagent`
- payment flow: working
- DM flow: working
- quote flow: working
- job completion flow: working

## What The Reviewer Should See

1. DM `catalog` to `@encoderagent`
2. DM `quote summarize | ...`
3. Receive a quote with a `jobId`
4. DM `accept <jobId>`
5. Receive a payment request
6. Pay it
7. See the job become `completed`

## Suggested Submission Text

Project name:
`Unicity Paid Service Agent`

Short description:
`A DM-native paid service agent on Unicity testnet. Users request a text service, receive a quote, accept it, pay through Unicity payment requests, and automatically receive the result back over DM.`

Track:
`Autonomous agents`

Agentic:
`Yes`

AstridOS:
`No`

Network:
`testnet`

Live agent:
`@encoderagent`

Run instructions:
`Set env from .env.example, run npm install, then npm run dev or deploy with systemd on Ubuntu. Interact with the live agent over Unicity DM using @encoderagent.`

## Submission Checklist

- code is public in a readable repository
- live deployment is available
- README explains setup and run steps
- demo screenshots or a short video are ready
- nametag is included in the submission
- project is described as `agentic`
- testnet usage is clearly mentioned

## Recommended Screenshots

- `catalog` reply from the agent
- quote reply with `jobId`
- payment request pending
- final `status: completed`

## Recovery Phrase

Never place any wallet recovery phrase in a public repo, screenshot, or public document.

## Suggested Next Improvements

- add a richer text service backed by an LLM
- add better payment history and audit logs
- add invoice-style receipts
- add a web UI for non-technical demos
