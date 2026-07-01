import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ServiceName = "summarize" | "rewrite" | "keywords" | "title";

export type JobStatus =
  | "quoted"
  | "awaiting_payment"
  | "paid"
  | "completed"
  | "cancelled"
  | "failed";

export type ServiceJob = {
  id: string;
  customerId: string;
  customerNametag?: string;
  customerPubkey?: string;
  service: ServiceName;
  input: string;
  quoteAmount: string;
  coinId: string;
  status: JobStatus;
  requestId?: string;
  paymentEventId?: string;
  result?: string;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

type StoreShape = {
  jobs: ServiceJob[];
};

const EMPTY_STORE: StoreShape = { jobs: [] };

export class JobStore {
  private jobs = new Map<string, ServiceJob>();

  constructor(private readonly filePath: string) {}

  async load() {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as StoreShape;
      for (const job of parsed.jobs ?? []) {
        this.jobs.set(job.id, job);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
      await this.save();
    }
  }

  list() {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  get(jobId: string) {
    return this.jobs.get(jobId);
  }

  findByRequestId(requestId: string) {
    return this.list().find((job) => job.requestId === requestId);
  }

  async upsert(job: ServiceJob) {
    this.jobs.set(job.id, job);
    await this.save();
  }

  async patch(jobId: string, patch: Partial<ServiceJob>) {
    const current = this.jobs.get(jobId);
    if (!current) {
      return undefined;
    }

    const next = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };

    this.jobs.set(jobId, next);
    await this.save();
    return next;
  }

  private async save() {
    const payload = JSON.stringify(
      {
        jobs: this.list(),
      },
      null,
      2,
    );
    await writeFile(this.filePath, payload, "utf8");
  }
}
