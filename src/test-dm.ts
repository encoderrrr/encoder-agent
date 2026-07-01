import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { Sphere, type DirectMessage, type NetworkType } from "@unicitylabs/sphere-sdk";
import { createNodeProviders } from "@unicitylabs/sphere-sdk/impl/nodejs";
import { createWalletApiProviders } from "@unicitylabs/sphere-sdk/impl/shared/wallet-api";

const env = {
  network: (process.env.SPHERE_NETWORK ?? "testnet") as NetworkType,
  oracleApiKey: process.env.SPHERE_ORACLE_API_KEY ?? "sk_ddc3cfcc001e4a28ac3fad7407f99590",
  walletApiBaseUrl: process.env.SPHERE_WALLET_API_BASE_URL ?? "https://wallet-api.unicity.network",
  deviceId: process.env.SPHERE_TEST_DEVICE_ID ?? "paid-service-agent-dm-test",
  dataDir: process.env.SPHERE_TEST_DATA_DIR ?? "./dm-test-wallet-data",
  tokensDir: process.env.SPHERE_TEST_TOKENS_DIR ?? "./dm-test-tokens-data",
  nametag: process.env.SPHERE_TEST_NAMETAG?.trim() || undefined,
};

function normalizeNetworkForWalletApi(network: NetworkType) {
  return network === "testnet" ? "testnet2" : network;
}

function usage() {
  console.log("Usage:");
  console.log("npm run test:dm -- <recipient> <message...>");
  console.log("Example:");
  console.log("npm run test:dm -- @encoderagent catalog");
}

async function waitForReply(
  sphere: Awaited<ReturnType<typeof Sphere.init>>["sphere"],
  timeoutMs: number,
) {
  return new Promise<DirectMessage | null>((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, timeoutMs);

    const unsubscribe = sphere.communications.onDirectMessage((message) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(message);
    });
  });
}

async function main() {
  const [recipient, ...messageParts] = process.argv.slice(2);
  const message = messageParts.join(" ").trim();

  if (!recipient || !message) {
    usage();
    process.exitCode = 1;
    return;
  }

  await mkdir(env.dataDir, { recursive: true });
  await mkdir(env.tokensDir, { recursive: true });

  const baseProviders = createNodeProviders({
    network: env.network,
    dataDir: env.dataDir,
    tokensDir: env.tokensDir,
    oracle: {
      apiKey: env.oracleApiKey,
    },
  });

  const providers = createWalletApiProviders(baseProviders, {
    baseUrl: env.walletApiBaseUrl,
    network: normalizeNetworkForWalletApi(env.network),
    deviceId: env.deviceId,
  });

  const { sphere, created, generatedMnemonic } = await Sphere.init({
    ...providers,
    network: env.network,
    autoGenerate: true,
    dmSince: Math.floor(Date.now() / 1000) - 3600,
    nametag: env.nametag,
  });

  if (created && generatedMnemonic) {
    console.log("New test wallet created. Save this mnemonic somewhere safe:");
    console.log(generatedMnemonic);
  }

  console.log(`Test wallet identity: ${sphere.getNametag() ?? sphere.identity?.directAddress ?? "unknown"}`);
  console.log(`Sending DM to ${recipient}: ${message}`);

  await sphere.preResolveDM(recipient).catch(() => undefined);
  await sphere.communications.sendDM(recipient, message);

  console.log("DM sent. Waiting up to 20s for a reply...");

  const reply = await waitForReply(sphere, 20_000);
  if (!reply) {
    console.log("No reply received within 20s.");
    return;
  }

  console.log("Reply received:");
  console.log(`From: ${reply.senderNametag ?? reply.senderPubkey}`);
  console.log(reply.content);
}

main().catch((error) => {
  console.error("DM test failed:", error);
  process.exitCode = 1;
});
