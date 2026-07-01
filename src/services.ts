import type { ServiceName } from "./jobStore.js";

const UCT_DECIMALS = 18n;
const UCT_SCALE = 10n ** UCT_DECIMALS;
const DEFAULT_QUOTE_UCT = 5n;
const DEFAULT_QUOTE_SCALE = 100n;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
  "this",
  "these",
  "those",
  "you",
  "your",
  "we",
  "our",
  "they",
  "their",
  "or",
  "but",
  "if",
  "then",
  "than",
  "into",
  "over",
  "about",
  "after",
  "before",
  "can",
  "could",
  "should",
  "would",
]);

export function getServiceCatalog() {
  return [
    {
      name: "summarize" as const,
      description: "matn ro be sorat kholaseh va qabel ersal bar migardanad",
      basePrice: "0.05",
    },
    {
      name: "rewrite" as const,
      description: "matn ro tamiztar, roshan tar, va qabel ferestadan dobareh minevisad",
      basePrice: "0.05",
    },
    {
      name: "keywords" as const,
      description: "kelidvazhehaye mohem ra estekhraj mikonad",
      basePrice: "0.05",
    },
    {
      name: "title" as const,
      description: "baraye matn chand onvan pishnahad midahad",
      basePrice: "0.05",
    },
  ];
}

export function isServiceName(value: string): value is ServiceName {
  return getServiceCatalog().some((service) => service.name === value);
}

export function quoteFor(service: ServiceName, input: string) {
  const catalog = getServiceCatalog().find((item) => item.name === service)!;
  const _ = input;
  return humanUctToRaw(catalog.basePrice);
}

export function humanUctToRaw(input: string) {
  const [wholePart, fractionPart = ""] = input.trim().split(".");
  const whole = BigInt(wholePart || "0");
  const fraction = (fractionPart + "0".repeat(Number(UCT_DECIMALS))).slice(0, Number(UCT_DECIMALS));
  return (whole * UCT_SCALE + BigInt(fraction || "0")).toString();
}

export function rawUctToHuman(input: string) {
  const amount = BigInt(input);
  const whole = amount / UCT_SCALE;
  const fraction = amount % UCT_SCALE;
  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionText = fraction.toString().padStart(Number(UCT_DECIMALS), "0").replace(/0+$/, "");
  return `${whole.toString()}.${fractionText}`;
}

export function defaultQuoteHumanAmount() {
  return `${DEFAULT_QUOTE_UCT / DEFAULT_QUOTE_SCALE}.${(DEFAULT_QUOTE_UCT % DEFAULT_QUOTE_SCALE).toString().padStart(2, "0")}`;
}

function cleanText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function splitSentences(input: string) {
  return cleanText(input)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractKeywords(input: string, limit = 8) {
  const words = cleanText(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));

  const scores = new Map<string, number>();
  for (const word of words) {
    scores.set(word, (scores.get(word) ?? 0) + 1);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function summarize(input: string) {
  const sentences = splitSentences(input);
  if (sentences.length === 0) {
    return "Matni baraye kholase kardan peyda نشد.";
  }

  const summary = sentences.slice(0, 3).join(" ");
  return summary.length > 700 ? `${summary.slice(0, 697)}...` : summary;
}

function rewrite(input: string) {
  const text = cleanText(input);
  if (!text) {
    return "Matni baraye baznevisi peyda نشد.";
  }

  const sentences = splitSentences(text);
  const rewritten = sentences.length > 0 ? sentences : [text];
  return rewritten
    .map((sentence, index) => `${index + 1}. ${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`)
    .join("\n");
}

function keywords(input: string) {
  const items = extractKeywords(input);
  return items.length > 0 ? items.join(", ") : "Kelidvazheye monasebi peyda نشد.";
}

function title(input: string) {
  const items = extractKeywords(input, 5);
  if (items.length === 0) {
    return "1. Smart Update\n2. Clear Summary\n3. Action Notes";
  }

  return [
    `1. ${items.slice(0, 2).map(capitalize).join(" ")}`,
    `2. ${items.slice(0, 3).map(capitalize).join(" ")}`,
    `3. ${capitalize(items[0])}: Quick Brief`,
  ].join("\n");
}

function capitalize(input: string) {
  return `${input.charAt(0).toUpperCase()}${input.slice(1)}`;
}

export function executeService(service: ServiceName, input: string) {
  switch (service) {
    case "summarize":
      return summarize(input);
    case "rewrite":
      return rewrite(input);
    case "keywords":
      return keywords(input);
    case "title":
      return title(input);
  }
}
