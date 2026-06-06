import { NextRequest, NextResponse } from "next/server";

const DEXSCREENER_SEARCH = "https://api.dexscreener.com/latest/dex/search?q=";
const DEXSCREENER_TOKEN = "https://api.dexscreener.com/latest/dex/tokens/";
const BSCSCAN_API = "https://api.bscscan.com/api";

// Free BscScan API key (public demo key)
const BSCSCAN_API_KEY = "YourApiKeyToken";

interface DexPair {
  chainId: string;
  dexId: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative?: string;
  priceUsd?: string;
  txns?: {
    h24: { buys: number; sells: number };
  };
  volume?: {
    h24?: number;
  };
  priceChange?: {
    h24?: number;
    h6?: number;
    m5?: number;
  };
  liquidity?: {
    usd?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairAddress?: string;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

interface TokenData {
  contractAddress: string;
  name: string;
  symbol: string;
  priceUsd: number | null;
  priceChange24h: number | null;
  priceChange6h: number | null;
  volume24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
  fdv: number | null;
  dex: string;
  pairAddress: string;
  chainId: string;
  txns24h: { buys: number; sells: number } | null;
  imageUrl: string | null;
  bscscanUrl: string;
}

function deduplicateTokens(pairs: DexPair[]): TokenData[] {
  const seen = new Map<string, DexPair>();

  for (const pair of pairs) {
    if (pair.chainId !== "bsc") continue;
    const addr = pair.baseToken.address.toLowerCase();
    const existing = seen.get(addr);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      seen.set(addr, pair);
    }
  }

  const tokens: TokenData[] = [];
  for (const [, pair] of seen) {
    tokens.push({
      contractAddress: pair.baseToken.address.toLowerCase(),
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      priceChange24h: pair.priceChange?.h24 ?? null,
      priceChange6h: pair.priceChange?.h6 ?? null,
      volume24h: pair.volume?.h24 ?? null,
      liquidity: pair.liquidity?.usd ?? null,
      marketCap: pair.marketCap ?? null,
      fdv: pair.fdv ?? null,
      dex: pair.dexId || "unknown",
      pairAddress: pair.pairAddress || "",
      chainId: pair.chainId,
      txns24h: pair.txns?.h24 ?? null,
      imageUrl: pair.info?.imageUrl ?? null,
      bscscanUrl: `https://bscscan.com/token/${pair.baseToken.address}`,
    });
  }

  return tokens;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const searchQuery = searchParams.get("q") || "";
  const addressQuery = searchParams.get("address") || "";
  const sort = searchParams.get("sort") || "priceChange24h";
  const order = searchParams.get("order") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    let tokens: TokenData[] = [];

    if (addressQuery) {
      // Look up specific contract address via DexScreener
      const res = await fetch(`${DEXSCREENER_TOKEN}${addressQuery}`);
      if (!res.ok) throw new Error("DexScreener API error");
      const data = await res.json();
      const pairs: DexPair[] = data.pairs || [];
      tokens = deduplicateTokens(pairs);

      // Also try to get info from BscScan
      try {
        const bscRes = await fetch(
          `${BSCSCAN_API}?module=account&action=tokentx&contractaddress=${addressQuery}&page=1&offset=1&sort=desc&apikey=${BSCSCAN_API_KEY}`
        );
        if (bscRes.ok) {
          const bscData = await bscRes.json();
          if (bscData.result && Array.isArray(bscData.result) && bscData.result.length > 0) {
            const tokenInfo = bscData.result[0];
            if (tokens.length === 0) {
              tokens.push({
                contractAddress: addressQuery.toLowerCase(),
                name: tokenInfo.tokenName || "Unknown",
                symbol: tokenInfo.tokenSymbol || "???",
                priceUsd: null,
                priceChange24h: null,
                priceChange6h: null,
                volume24h: null,
                liquidity: null,
                marketCap: null,
                fdv: null,
                dex: "bscscan",
                pairAddress: "",
                chainId: "bsc",
                txns24h: null,
                imageUrl: null,
                bscscanUrl: `https://bscscan.com/token/${addressQuery}`,
              });
            }
          }
        }
      } catch {
        // BscScan lookup failed, continue with DexScreener data
      }
    } else if (searchQuery) {
      // Search tokens via DexScreener
      const res = await fetch(`${DEXSCREENER_SEARCH}${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("DexScreener API error");
      const data = await res.json();
      const pairs: DexPair[] = data.pairs || [];
      tokens = deduplicateTokens(pairs);
    } else {
      // Default: fetch a broad set of BSC tokens by searching popular terms
      const searchTerms = ["bnb", "cake", "bsc", "pancake", "doge bsc"];
      const allPairs: DexPair[] = [];

      const results = await Promise.allSettled(
        searchTerms.map(async (term) => {
          const res = await fetch(`${DEXSCREENER_SEARCH}${encodeURIComponent(term)}`);
          if (!res.ok) return [];
          const data = await res.json();
          return (data.pairs || []) as DexPair[];
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          allPairs.push(...result.value);
        }
      }

      tokens = deduplicateTokens(allPairs);

      // Also fetch the UNL token specifically
      try {
        const unlRes = await fetch(`${DEXSCREENER_TOKEN}0x1B9cf733c04c7bC3B81F1DC3E580755597f59cE4`);
        if (unlRes.ok) {
          const unlData = await unlRes.json();
          const unlPairs: DexPair[] = unlData.pairs || [];
          const unlTokens = deduplicateTokens(unlPairs);
          const existingAddrs = new Set(tokens.map((t) => t.contractAddress));
          for (const t of unlTokens) {
            if (!existingAddrs.has(t.contractAddress)) {
              tokens.push(t);
            }
          }
        }
      } catch {
        // UNL token fetch failed, continue
      }
    }

    // Sort tokens
    tokens.sort((a, b) => {
      const aVal = a[sort as keyof TokenData];
      const bVal = b[sort as keyof TokenData];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return order === "desc" ? bVal - aVal : aVal - bVal;
      }
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      return 0;
    });

    // Paginate
    const total = tokens.length;
    const start = (page - 1) * limit;
    const paginatedTokens = tokens.slice(start, start + limit);

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      tokens: paginatedTokens,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message, tokens: [], total: 0 },
      { status: 500 }
    );
  }
}
