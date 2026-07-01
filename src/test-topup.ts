import "dotenv/config";

import { mkdir } from "node:fs/promises";

import { Sphere, getCoinIdBySymbol, type NetworkType } from "@unicitylabs/sphere-sdk";
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

const UCT_DECIMALS = 18n;
const UCT_SCALE = 10n ** UCT_DECIMALS;
const UCT_TESTNET2_COIN_ID = "f581d30f593e4b369d684a4563b5246f07b1d265f7178a2c0a82b81f39c24dc0";

function normalizeNetworkForWalletApi(network: NetworkType) {
  return network === "testnet" ? "testnet2" : network;
}

function humanUctToRaw(input: string) {
  const [wholePart, fractionPart = ""] = input.trim().split(".");
  const whole = BigInt(wholePart || "0");
  const fraction = (fractionPart + "0".repeat(Number(UCT_DECIMALS))).slice(0, Number(UCT_DECIMALS));
  return whole * UCT_SCALE + BigInt(fraction || "0");
}

function usage() {
  console.log("Usage:");
  console.log("npm run test:topup -- 1");
  console.log("npm run test:topup -- 0.1");
}

async function main() {
  const [amountArg = "1"] = process.argv.slice(2);
  const uctCoinId = getCoinIdBySymbol("UCT") ?? UCT_TESTNET2_COIN_ID;

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

  const rawAmount = humanUctToRaw(amountArg);
  console.log(`Test wallet identity: ${sphere.getNametag() ?? sphere.identity?.directAddress ?? "unknown"}`);
  console.log(`Minting ${amountArg} UCT to test wallet...`);

  const result = await sphere.payments.mintFungibleToken(uctCoinId, rawAmount);
  if (!result.success) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  console.log(`Topup successful. Token id: ${result.tokenId}`);
}

main().catch((error) => {
  usage();
  console.error("Topup test failed:", error);
  process.exitCode = 1;
});
