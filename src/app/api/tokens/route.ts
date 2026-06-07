import { NextRequest, NextResponse } from "next/server";

const DEXSCREENER_SEARCH = "https://api.dexscreener.com/latest/dex/search?q=";
const DEXSCREENER_TOKEN = "https://api.dexscreener.com/latest/dex/tokens/";
const DEXSCREENER_PROFILES = "https://api.dexscreener.com/token-profiles/latest/v1";
const DEXSCREENER_BOOSTS = "https://api.dexscreener.com/token-boosts/top/v1";
const BSCSCAN_API = "https://api.bscscan.com/api";

const BSCSCAN_API_KEY = "YourApiKeyToken";

// Known BSC tokens to always include
const FEATURED_TOKENS = [
  "0x1B9cf733c04c7bC3B81F1DC3E580755597f59cE4", // UNL
  "0xF2874b590a7D743725c923426d43387A50cbD1Be", // Blcio
  "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", // CAKE
  "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", // ETH on BSC
  "0x55d398326f99059fF775485246999027B3197955", // USDT on BSC
  "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
];

// Search terms based on crypto categories/narratives (from Mudrex categories + web3)
const DISCOVERY_TERMS = [
  "gaming bsc",
  "social media bsc",
  "staking bsc",
  "real world assets bsc",
  "layer 2 bsc",
  "depin bsc",
  "storage bsc",
  "education bsc",
  "web3 token bsc",
  "defi bsc",
  "web3 infrastructure bsc",
  "privacy bsc",
  "fan token bsc",
  "meme bsc",
  "scaling bsc",
  "artificial intelligence bsc",
  "stablecoin bsc",
  "web3 bsc",
];

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

interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { label?: string; type?: string; url: string }[];
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
  isFeatured: boolean;
}

function deduplicateTokens(pairs: DexPair[], existingAddrs?: Set<string>): TokenData[] {
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
    const addr = pair.baseToken.address.toLowerCase();
    if (existingAddrs?.has(addr)) continue;
    tokens.push({
      contractAddress: addr,
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
      isFeatured: false,
    });
  }

  return tokens;
}

async function fetchTokenByAddress(address: string): Promise<TokenData[]> {
  try {
    const res = await fetch(`${DEXSCREENER_TOKEN}${address}`);
    if (!res.ok) return [];
    const data = await res.json();
    return deduplicateTokens(data.pairs || []);
  } catch {
    return [];
  }
}

async function fetchBscTokenProfiles(): Promise<string[]> {
  // Get BSC token addresses from DexScreener profiles
  try {
    const res = await fetch(DEXSCREENER_PROFILES);
    if (!res.ok) return [];
    const profiles: TokenProfile[] = await res.json();
    return profiles
      .filter((p) => p.chainId === "bsc")
      .map((p) => p.tokenAddress);
  } catch {
    return [];
  }
}

async function fetchBscBoostedTokens(): Promise<string[]> {
  // Get BSC boosted token addresses
  try {
    const res = await fetch(DEXSCREENER_BOOSTS);
    if (!res.ok) return [];
    const boosts: TokenProfile[] & { totalAmount?: number }[] = await res.json();
    return boosts
      .filter((b) => b.chainId === "bsc")
      .map((b) => b.tokenAddress);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const searchQuery = searchParams.get("q") || "";
  const addressQuery = searchParams.get("address") || "";
  const sort = searchParams.get("sort") || "priceChange24h";
  const order = searchParams.get("order") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "100");

  try {
    let tokens: TokenData[] = [];
    const allAddrs = new Set<string>();

    const addTokens = (newTokens: TokenData[]) => {
      for (const t of newTokens) {
        if (!allAddrs.has(t.contractAddress)) {
          allAddrs.add(t.contractAddress);
          tokens.push(t);
        }
      }
    };

    if (addressQuery) {
      // Look up specific contract address
      const found = await fetchTokenByAddress(addressQuery);
      addTokens(found);

      // If DexScreener didn't have it, try BscScan
      if (tokens.length === 0) {
        try {
          const bscRes = await fetch(
            `${BSCSCAN_API}?module=account&action=tokentx&contractaddress=${addressQuery}&page=1&offset=1&sort=desc&apikey=${BSCSCAN_API_KEY}`
          );
          if (bscRes.ok) {
            const bscData = await bscRes.json();
            if (bscData.result && Array.isArray(bscData.result) && bscData.result.length > 0) {
              const tokenInfo = bscData.result[0];
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
                isFeatured: true,
              });
            }
          }
        } catch {
          // BscScan lookup failed
        }
      }
    } else if (searchQuery) {
      // Search tokens via DexScreener
      const res = await fetch(`${DEXSCREENER_SEARCH}${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("DexScreener API error");
      const data = await res.json();
      const found = deduplicateTokens(data.pairs || []);
      addTokens(found);
    } else {
      // === DEFAULT: Comprehensive BSC token discovery ===

      // Step 1: Fetch featured tokens directly by address
      const featuredResults = await Promise.allSettled(
        FEATURED_TOKENS.map((addr) => fetchTokenByAddress(addr))
      );
      for (const result of featuredResults) {
        if (result.status === "fulfilled") {
          for (const t of result.value) {
            t.isFeatured = true;
          }
          addTokens(result.value);
        }
      }

      // Step 2: Get BSC tokens from DexScreener token profiles
      const profileAddresses = await fetchBscTokenProfiles();
      if (profileAddresses.length > 0) {
        // Fetch in batches of 5 to avoid rate limiting
        const batchSize = 5;
        for (let i = 0; i < Math.min(profileAddresses.length, 30); i += batchSize) {
          const batch = profileAddresses.slice(i, i + batchSize);
          const batchResults = await Promise.allSettled(
            batch.map((addr) => fetchTokenByAddress(addr))
          );
          for (const result of batchResults) {
            if (result.status === "fulfilled") {
              addTokens(result.value);
            }
          }
        }
      }

      // Step 3: Get BSC boosted tokens
      const boostAddresses = await fetchBscBoostedTokens();
      if (boostAddresses.length > 0) {
        const boostResults = await Promise.allSettled(
          boostAddresses.slice(0, 10).map((addr) => fetchTokenByAddress(addr))
        );
        for (const result of boostResults) {
          if (result.status === "fulfilled") {
            addTokens(result.value);
          }
        }
      }

      // Step 4: Broad search for trending BSC tokens
      const searchResults = await Promise.allSettled(
        DISCOVERY_TERMS.map(async (term) => {
          const res = await fetch(`${DEXSCREENER_SEARCH}${encodeURIComponent(term)}`);
          if (!res.ok) return [] as DexPair[];
          const data = await res.json();
          return (data.pairs || []) as DexPair[];
        })
      );

      for (const result of searchResults) {
        if (result.status === "fulfilled") {
          const found = deduplicateTokens(result.value, allAddrs);
          addTokens(found);
        }
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
