import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  Sphere,
  type IncomingTransfer,
  type NetworkType,
  type PaymentRequestResponse,
} from "@unicitylabs/sphere-sdk";
import { createNodeProviders } from "@unicitylabs/sphere-sdk/impl/nodejs";
import { createWalletApiProviders } from "@unicitylabs/sphere-sdk/impl/shared/wallet-api";

import { JobStore, type ServiceJob } from "./jobStore.js";
import { executeService, getServiceCatalog, isServiceName, quoteFor, rawUctToHuman } from "./services.js";

const env = {
  network: (process.env.SPHERE_NETWORK ?? "testnet") as NetworkType,
  oracleApiKey: process.env.SPHERE_ORACLE_API_KEY ?? "sk_ddc3cfcc001e4a28ac3fad7407f99590",
  walletApiBaseUrl: process.env.SPHERE_WALLET_API_BASE_URL ?? "https://wallet-api.unicity.network",
  deviceId: process.env.SPHERE_DEVICE_ID ?? "paid-service-agent-local",
  dataDir: process.env.SPHERE_DATA_DIR ?? "./wallet-data",
  tokensDir: process.env.SPHERE_TOKENS_DIR ?? "./tokens-data",
  nametag: process.env.SPHERE_NAMETAG?.trim() || undefined,
  authorizedSenders: new Set(
    (process.env.AUTHORIZED_SENDERS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ),
  serviceCoinId: process.env.SERVICE_COIN_ID ?? "UCT",
  quoteExpiryMinutes: Number(process.env.QUOTE_EXPIRY_MINUTES ?? "30"),
};

function normalizeNetworkForWalletApi(network: NetworkType) {
  return network === "testnet" ? "testnet2" : network;
}

function isAuthorized(sender: string | undefined) {
  if (!sender) {
    return false;
  }

  if (env.authorizedSenders.size === 0) {
    return true;
  }

  return env.authorizedSenders.has(sender);
}

function makeJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatCatalog() {
  return [
    "Services:",
    ...getServiceCatalog().map(
      (service) => `- ${service.name}: ${service.description} | az ${service.basePrice} ${env.serviceCoinId}`,
    ),
    "",
    "Commands:",
    "catalog",
    "quote <service> | <text>",
    "accept <jobId>",
    "status <jobId>",
    "jobs",
    "balance",
    "help",
  ].join("\n");
}

function formatJob(job: ServiceJob) {
  return [
    `job: ${job.id}`,
    `service: ${job.service}`,
    `status: ${job.status}`,
    `quote: ${rawUctToHuman(job.quoteAmount)} ${job.coinId}`,
    `created: ${new Date(job.createdAt).toISOString()}`,
    `expires: ${new Date(job.expiresAt).toISOString()}`,
    job.requestId ? `requestId: ${job.requestId}` : undefined,
    job.failureReason ? `reason: ${job.failureReason}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCustomerJobs(jobs: ServiceJob[]) {
  if (jobs.length === 0) {
    return "Hanooz jobi sabt نشده.";
  }

  return jobs
    .slice(0, 10)
    .map((job) => `${job.id} | ${job.service} | ${job.status} | ${rawUctToHuman(job.quoteAmount)} ${job.coinId}`)
    .join("\n");
}

function isJobOwnedBySender(
  job: ServiceJob | undefined,
  message: { senderNametag?: string; senderPubkey?: string },
  sender: string | undefined,
) {
  if (!job) {
    return false;
  }

  const candidates = new Set(
    [sender, message.senderNametag, message.senderPubkey, job.customerId, job.customerNametag, job.customerPubkey]
      .filter(Boolean)
      .map((value) => value!.trim()),
  );

  const customerKeys = [job.customerId, job.customerNametag, job.customerPubkey]
    .filter(Boolean)
    .map((value) => value!.trim());

  return customerKeys.some((value) => candidates.has(value));
}

function parseQuoteCommand(input: string) {
  const match = input.trim().match(/^quote\s+([a-z]+)\s*\|\s*([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  const service = match[1]?.toLowerCase() ?? "";
  const text = match[2]?.trim() ?? "";

  if (!isServiceName(service) || !text) {
    return null;
  }

  return { service, text };
}

function parseSimpleCommand(input: string, command: string) {
  const match = input.trim().match(new RegExp(`^${command}\\s+(.+)$`, "i"));
  return match?.[1]?.trim() ?? null;
}

async function sendSafeDm(
  sphere: Awaited<ReturnType<typeof Sphere.init>>["sphere"],
  recipient: string | undefined,
  message: string,
) {
  if (!recipient) {
    return;
  }

  try {
    await sphere.communications.sendDM(recipient, message);
  } catch (error) {
    console.error(`Failed to DM ${recipient}:`, error);
  }
}

async function executePaidJob(
  sphere: Awaited<ReturnType<typeof Sphere.init>>["sphere"],
  store: JobStore,
  job: ServiceJob,
) {
  try {
    const result = executeService(job.service, job.input);
    await store.patch(job.id, {
      status: "completed",
      result,
    });

    await sendSafeDm(
      sphere,
      job.customerNametag ?? job.customerPubkey,
      [
        `pardakht taeed shod baraye ${job.id}`,
        "",
        "natije:",
        result,
      ].join("\n"),
    );
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    await store.patch(job.id, {
      status: "failed",
      failureReason,
    });

    await sendSafeDm(
      sphere,
      job.customerNametag ?? job.customerPubkey,
      `job ${job.id} ba khata motevaghef shod: ${failureReason}`,
    );
  }
}

async function main() {
  await mkdir(env.dataDir, { recursive: true });
  const jobStore = new JobStore(path.join(env.dataDir, "service-jobs.json"));
  await jobStore.load();

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
    console.log("New wallet created. Save this mnemonic somewhere safe:");
    console.log(generatedMnemonic);
  }

  if (env.nametag && !sphere.hasNametag()) {
    try {
      const available = await sphere.isNametagAvailable(env.nametag);
      if (available) {
        await sphere.registerNametag(env.nametag);
        console.log(`Nametag registered: ${env.nametag}`);
      } else {
        console.warn(`Nametag unavailable: ${env.nametag}`);
      }
    } catch (error) {
      console.error(`Failed to register nametag ${env.nametag}:`, error);
    }
  }

  console.log(`Paid service agent connected to ${env.network}.`);
  console.log(`Agent identity: ${sphere.getNametag() ?? sphere.identity?.nametag ?? sphere.identity?.directAddress ?? "unknown"}`);
  console.log(`Customer allowlist: ${env.authorizedSenders.size === 0 ? "open" : [...env.authorizedSenders].join(", ")}`);

  try {
    const { transfers } = await sphere.payments.receive(undefined, (transfer: IncomingTransfer) => {
      console.log(
        "Received transfer:",
        transfer.id,
        transfer.senderNametag ?? transfer.senderPubkey,
        transfer.memo ?? "",
      );
    });
    console.log(`Receive sync complete. Transfers drained: ${transfers.length}`);
  } catch (error) {
    console.error("Initial receive sync failed:", error);
  }

  sphere.payments.onPaymentRequestResponse(async (response: PaymentRequestResponse) => {
    const job = jobStore.findByRequestId(response.requestId);
    if (!job) {
      return;
    }

    if (response.responseType === "rejected") {
      await jobStore.patch(job.id, {
        status: "cancelled",
        failureReason: response.message ?? "payment request rejected",
      });
      await sendSafeDm(
        sphere,
        job.customerNametag ?? job.customerPubkey,
        `darkhast pardakht baraye ${job.id} rad shod.`,
      );
      return;
    }

    if (response.responseType === "accepted") {
      await sendSafeDm(
        sphere,
        job.customerNametag ?? job.customerPubkey,
        `darkhast pardakht baraye ${job.id} accept shod. montazer paid mimoonam.`,
      );
      return;
    }

    if (response.responseType === "paid") {
      const paidJob = await jobStore.patch(job.id, {
        status: "paid",
        paymentEventId: response.id,
      });

      if (paidJob) {
        await executePaidJob(sphere, jobStore, paidJob);
      }
    }
  });

  sphere.communications.onDirectMessage(async (message) => {
    const sender = message.senderNametag ?? message.senderPubkey;
    const content = message.content.trim();

    console.log(`DM from ${sender}: ${content}`);

    if (!isAuthorized(sender)) {
      await sendSafeDm(sphere, sender, "shoma mojaz be estefade az in agent nistid.");
      return;
    }

    if (/^help$/i.test(content) || /^catalog$/i.test(content)) {
      await sendSafeDm(sphere, sender, formatCatalog());
      return;
    }

    if (/^balance$/i.test(content)) {
        const assets = await sphere.payments.getAssets();
      const assetLines =
        assets.length === 0
          ? "No assets found."
          : assets.map((asset) => `${asset.totalAmount ?? "0"} ${asset.symbol ?? asset.coinId ?? "UNKNOWN"}`).join("\n");
      await sendSafeDm(sphere, sender, assetLines);
      return;
    }

    if (/^jobs$/i.test(content)) {
      const jobs = jobStore.list().filter((job) => isJobOwnedBySender(job, message, sender));
      await sendSafeDm(sphere, sender, formatCustomerJobs(jobs));
      return;
    }

    const statusJobId = parseSimpleCommand(content, "status");
    if (statusJobId) {
      const job = jobStore.get(statusJobId);
      if (!job || !isJobOwnedBySender(job, message, sender)) {
        await sendSafeDm(sphere, sender, "job peyda نشد.");
        return;
      }
      await sendSafeDm(sphere, sender, formatJob(job));
      return;
    }

    const quoteInput = parseQuoteCommand(content);
    if (quoteInput) {
      const quoteAmount = quoteFor(quoteInput.service, quoteInput.text);
      const job: ServiceJob = {
        id: makeJobId(),
        customerId: sender ?? "unknown",
        customerNametag: message.senderNametag,
        customerPubkey: message.senderPubkey,
        service: quoteInput.service,
        input: quoteInput.text,
        quoteAmount,
        coinId: env.serviceCoinId,
        status: "quoted",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + env.quoteExpiryMinutes * 60_000,
      };

      await jobStore.upsert(job);
      await sendSafeDm(
        sphere,
        sender,
        [
          "quote sader shod:",
          formatJob(job),
          "",
          `baraye edame befrest: accept ${job.id}`,
        ].join("\n"),
      );
      return;
    }

    const acceptJobId = parseSimpleCommand(content, "accept");
    if (acceptJobId) {
      const job = jobStore.get(acceptJobId);
      if (!job || !isJobOwnedBySender(job, message, sender)) {
        await sendSafeDm(sphere, sender, "job peyda نشد.");
        return;
      }

      if (job.status !== "quoted") {
        await sendSafeDm(sphere, sender, `in job dar halat ${job.status} ast.`);
        return;
      }

      if (Date.now() > job.expiresAt) {
        const expiredJob = await jobStore.patch(job.id, {
          status: "cancelled",
          failureReason: "quote expired",
        });
        await sendSafeDm(sphere, sender, `quote ${expiredJob?.id ?? job.id} expire shode.`);
        return;
      }

      const requestResult = await sphere.payments.sendPaymentRequest(sender!, {
        amount: job.quoteAmount,
        coinId: job.coinId,
        message: `Payment for ${job.id} (${job.service})`,
        metadata: {
          jobId: job.id,
          service: job.service,
        },
      });

      if (!requestResult.success || !requestResult.requestId) {
        await sendSafeDm(
          sphere,
          sender,
          `ersal darkhast pardakht movafagh نبود: ${requestResult.error ?? "unknown error"}`,
        );
        return;
      }

      const nextJob = await jobStore.patch(job.id, {
        status: "awaiting_payment",
        requestId: requestResult.requestId,
        paymentEventId: requestResult.eventId,
      });

      await sendSafeDm(
        sphere,
        sender,
        [
          `darkhast pardakht sader shod baraye ${nextJob?.id ?? job.id}.`,
          `${rawUctToHuman(job.quoteAmount)} ${job.coinId}`,
          "vaghti wallet payment ro paid kone, natije otomatik DM mishavad.",
        ].join("\n"),
      );
      return;
    }

    await sendSafeDm(
      sphere,
      sender,
      "command ro nafahmidam. `catalog` ya `help` ro befrest.",
    );
  });

  setInterval(async () => {
    try {
      await sphere.payments.receive();

      if ("syncPaymentRequests" in sphere.payments && typeof sphere.payments.syncPaymentRequests === "function") {
        await sphere.payments.syncPaymentRequests();
      }
    } catch (error) {
      console.error("Background sync failed:", error);
    }
  }, 30_000);
}

main().catch((error) => {
  console.error("Agent failed to start:", error);
  process.exitCode = 1;
});
