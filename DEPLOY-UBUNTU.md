# Ubuntu Deploy Guide

This guide explains how to run the agent on an Ubuntu server with `systemd`.

## 1. Install Node.js 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

## 2. Copy The Project

Example:

```bash
sudo mkdir -p /opt/uncutiy-agent
sudo chown -R $USER:$USER /opt/uncutiy-agent
```

Copy the files in with `scp`, `git clone`, or `WinSCP`, then:

```bash
cd /opt/uncutiy-agent
npm ci
npm run build
cp .env.example .env
```

## 3. Edit `.env`

Recommended values:

```env
SPHERE_NETWORK=testnet
SPHERE_ORACLE_API_KEY=sk_ddc3cfcc001e4a28ac3fad7407f99590
SPHERE_WALLET_API_BASE_URL=https://wallet-api.unicity.network
SPHERE_DEVICE_ID=paid-service-agent-server
SPHERE_DATA_DIR=./wallet-data
SPHERE_TOKENS_DIR=./tokens-data
SPHERE_NAMETAG=encoderagent
AUTHORIZED_SENDERS=
SERVICE_COIN_ID=UCT
QUOTE_EXPIRY_MINUTES=30
SPHERE_TEST_DEVICE_ID=paid-service-agent-dm-test
SPHERE_TEST_DATA_DIR=./dm-test-wallet-data
SPHERE_TEST_TOKENS_DIR=./dm-test-tokens-data
```

## 4. First Manual Run

```bash
cd /opt/uncutiy-agent
npm run start
```

If you see `Agent identity: encoderagent` or a valid `DIRECT://...` address, the runtime is healthy.
Use `Ctrl+C` to stop the manual run.

## 5. Create Log Directory

```bash
sudo mkdir -p /var/log/uncutiy-agent
sudo chown -R $USER:$USER /var/log/uncutiy-agent
```

## 6. Install The `systemd` Service

Copy [deploy/uncutiy-agent.service](C:/Users/hamed/Desktop/ai/uncutiy/deploy/uncutiy-agent.service) to:

```bash
sudo cp deploy/uncutiy-agent.service /etc/systemd/system/uncutiy-agent.service
```

Check these values inside the service file if your environment differs:

- `User=hamed`
- `WorkingDirectory=/opt/uncutiy-agent`

## 7. Enable And Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable uncutiy-agent
sudo systemctl start uncutiy-agent
sudo systemctl status uncutiy-agent
```

## 8. Useful Commands

```bash
sudo systemctl restart uncutiy-agent
sudo systemctl stop uncutiy-agent
sudo journalctl -u uncutiy-agent -f
tail -f /var/log/uncutiy-agent/out.log
tail -f /var/log/uncutiy-agent/err.log
```

## 9. Local End-To-End Test On Server

Top up the local test wallet:

```bash
npm run test:topup -- 1
```

Quote:

```bash
npm run test:dm -- @encoderagent "quote summarize | hello world this is a test"
```

Accept the job:

```bash
npm run test:dm -- @encoderagent "accept <jobId>"
```

List payment requests:

```bash
npm run test:pay
```

Pay one:

```bash
npm run test:pay -- <requestId>
```

Check status:

```bash
npm run test:dm -- @encoderagent "status <jobId>"
```

## 10. For Submission

The reviewer should be able to see:

- the public code
- a live deployed agent
- the nametag `@encoderagent`
- an end-to-end payment-backed service flow
