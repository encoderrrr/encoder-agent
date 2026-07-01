import "dotenv/config";

import { mkdir } from "node:fs/promises";

import { Sphere, type NetworkType } from "@unicitylabs/sphere-sdk";
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
  console.log("npm run test:pay");
  console.log("npm run test:pay -- <requestId>");
}

async function main() {
  const [requestIdArg] = process.argv.slice(2);

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

  const { sphere } = await Sphere.init({
    ...providers,
    network: env.network,
    autoGenerate: true,
    dmSince: Math.floor(Date.now() / 1000) - 3600,
    nametag: env.nametag,
  });

  if ("syncPaymentRequests" in sphere.payments && typeof sphere.payments.syncPaymentRequests === "function") {
    await sphere.payments.syncPaymentRequests();
  }

  const pending = sphere.payments.getPaymentRequests({ status: "pending" });

  if (!requestIdArg) {
    if (pending.length === 0) {
      console.log("No pending payment requests.");
      return;
    }

    console.log("Pending payment requests:");
    for (const req of pending) {
      console.log(`${req.id} | from=${req.senderNametag ?? req.senderPubkey} | ${req.amount} ${req.symbol} | ${req.message ?? ""}`);
    }
    console.log("");
    console.log("Run:");
    console.log(`npm run test:pay -- ${pending[0].id}`);
    return;
  }

  const target = pending.find((req) => req.id === requestIdArg);
  if (!target) {
    console.log(`Pending request not found: ${requestIdArg}`);
    if (pending.length > 0) {
      console.log("Available pending request IDs:");
      for (const req of pending) {
        console.log(`- ${req.id}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Paying request ${target.id}: ${target.amount} ${target.symbol}`);
  const result = await sphere.payments.payPaymentRequest(target.id, `Paid by test wallet for ${target.id}`);
  console.log(`Payment sent. Status: ${result.status}`);
  if (result.deliveryPending) {
    console.log("Delivery pending.");
  }
}

main().catch((error) => {
  usage();
  console.error("Payment test failed:", error);
  process.exitCode = 1;
});
