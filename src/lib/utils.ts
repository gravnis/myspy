import crypto from "crypto";

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text.toLowerCase().trim()).digest("hex");
}

const VERTICAL_KEYWORDS: Record<string, string[]> = {
  gambling: ["casino", "bet", "slot", "poker", "gambling", "jackpot", "roulette", "blackjack", "казино", "ставки", "слот"],
  nutra: ["weight loss", "diet", "supplement", "health", "beauty", "skin", "cream", "похудение", "диета", "крем"],
  crypto: ["bitcoin", "crypto", "trading", "forex", "btc", "eth", "blockchain", "биткоин", "крипто", "трейдинг"],
  dating: ["dating", "meet", "love", "singles", "relationship", "знакомства", "свидание"],
  ecom: ["shop", "buy", "sale", "discount", "offer", "price", "order", "купить", "скидка", "магазин"],
  finance: ["loan", "credit", "insurance", "bank", "money", "invest", "кредит", "займ", "страховка"],
};

export function detectVertical(text: string): string {
  if (!text) return "other";
  const lower = text.toLowerCase();
  let bestMatch = "other";
  let bestScore = 0;

  for (const [vertical, keywords] of Object.entries(VERTICAL_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = vertical;
    }
  }

  return bestMatch;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  if (diffDays < 7) return `${diffDays}д назад`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}нед назад`;
  return `${Math.floor(diffDays / 30)}мес назад`;
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export function getPlanLimits(plan: string) {
  switch (plan) {
    case "PRO":
      return { maxProjects: Infinity, videoDownloads: 50, canDownload: true };
    case "BUSINESS":
      return { maxProjects: Infinity, videoDownloads: Infinity, canDownload: true };
    default:
      return { maxProjects: 3, videoDownloads: 0, canDownload: false };
  }
}
