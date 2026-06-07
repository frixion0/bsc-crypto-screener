"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Coins,
  BarChart3,
  Copy,
  Check,
  Flame,
  Zap,
  Filter,
  X,
  Star,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Activity,
  DollarSign,
  Hash,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type SortField =
  | "priceChange24h"
  | "priceUsd"
  | "volume24h"
  | "marketCap"
  | "liquidity"
  | "name";
type SortOrder = "asc" | "desc";
type FilterMode = "all" | "gainers" | "losers" | "volume" | "hot";

const UNL_ADDRESS = "0x1B9cf733c04c7bC3B81F1DC3E580755597f59cE4";
const BLCIO_ADDRESS = "0xF2874b590a7D743725c923426d43387A50cbD1Be";

// Mudrex crypto categories for quick search
const MUDREX_CATEGORIES = [
  { label: "Gaming", query: "gaming bsc", color: "violet" },
  { label: "Social Media", query: "social media bsc", color: "blue" },
  { label: "Staking", query: "staking bsc", color: "green" },
  { label: "Real World Assets", query: "real world assets bsc", color: "teal" },
  { label: "Layer 2", query: "layer 2 bsc", color: "cyan" },
  { label: "DePIN", query: "depin bsc", color: "orange" },
  { label: "Storage", query: "storage file sharing bsc", color: "amber" },
  { label: "Education", query: "education bsc", color: "lime" },
  { label: "DeFi", query: "defi bsc", color: "yellow" },
  { label: "Web3 Infra", query: "web3 infrastructure bsc", color: "purple" },
  { label: "Privacy", query: "privacy bsc", color: "slate" },
  { label: "Fan Token", query: "fan token bsc", color: "rose" },
  { label: "Meme", query: "meme bsc", color: "pink" },
  { label: "Scaling", query: "scaling bsc", color: "indigo" },
  { label: "AI", query: "artificial intelligence bsc", color: "emerald" },
  { label: "Stablecoin", query: "stablecoin bsc", color: "sky" },
  { label: "Smart Contracts", query: "smart contract platforms bsc", color: "fuchsia" },
  { label: "Payments", query: "payments bsc", color: "red" },
  { label: "CEX", query: "centralized exchange bsc", color: "orange" },
  { label: "Interoperability", query: "interoperability bsc", color: "blue" },
  { label: "DEX", query: "decentralized exchange bsc", color: "cyan" },
  { label: "Data Mgmt", query: "data management bsc", color: "teal" },
  { label: "Media", query: "media and entertainment bsc", color: "violet" },
  { label: "NFT/Metaverse", query: "nft metaverse bsc", color: "purple" },
  { label: "Web3 Token", query: "web3 token bsc", color: "yellow" },
] as const;

type CategoryColor = typeof MUDREX_CATEGORIES[number]["color"];

function formatNumber(num: number | null, decimals = 2): string {
  if (num === null || num === undefined) return "—";
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(decimals)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(decimals)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(decimals)}K`;
  return `$${num.toFixed(decimals)}`;
}

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return "—";
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(10)}`;
}

function formatPercent(pct: number | null): string {
  if (pct === null || pct === undefined) return "—";
  const sign = pct >= 0 ? "+" : "";
  if (Math.abs(pct) >= 1000) return `${sign}${pct.toFixed(0)}%`;
  return `${sign}${pct.toFixed(2)}%`;
}

function truncateAddress(addr: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function BSCScreener() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortField, setSortField] = useState<SortField>("priceChange24h");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);

  const fetchTokens = useCallback(async (query?: string, address?: string) => {
    setLoading(true);
    setError(null);

    try {
      let url = "/api/tokens?";
      if (address) {
        url += `address=${encodeURIComponent(address)}`;
      } else if (query) {
        url += `q=${encodeURIComponent(query)}`;
      }
      url += `&sort=${sortField}&order=${sortOrder}&limit=100`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch tokens");
      }

      setTokens(data.tokens || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tokens");
    } finally {
      setLoading(false);
    }
  }, [sortField, sortOrder]);

  // Initial load
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!searchQuery) {
        fetchTokens();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchTokens, searchQuery]);

  const handleSearch = useCallback(() => {
    const query = searchInput.trim();
    if (!query) {
      setSearchQuery("");
      fetchTokens();
      return;
    }

    // Check if it looks like a contract address
    if (query.startsWith("0x") && query.length >= 40) {
      setSearchQuery(query);
      fetchTokens(undefined, query);
    } else {
      setSearchQuery(query);
      fetchTokens(query);
    }
  }, [searchInput, fetchTokens]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      } else {
        setSortField(field);
        setSortOrder(field === "name" ? "asc" : "desc");
      }
    },
    [sortField]
  );

  const copyAddress = useCallback(async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddress(addr);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch {
      // Clipboard not available
    }
  }, []);

  const loadToken = useCallback(
    (address: string, label: string) => {
      setSearchInput(address);
      setSearchQuery(label);
      fetchTokens(undefined, address);
    },
    [fetchTokens]
  );

  const searchCategory = useCallback(
    (query: string, label: string) => {
      setSearchInput(label);
      setSearchQuery(label);
      fetchTokens(query);
    },
    [fetchTokens]
  );

  const getCategoryStyle = (color: CategoryColor, active: boolean) => {
    const colorMap: Record<string, string> = {
      violet: "bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20",
      blue: "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20",
      green: "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20",
      teal: "bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20",
      cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20",
      orange: "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20",
      amber: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20",
      lime: "bg-lime-500/10 border-lime-500/30 text-lime-400 hover:bg-lime-500/20",
      yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20",
      purple: "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20",
      slate: "bg-slate-500/10 border-slate-500/30 text-slate-400 hover:bg-slate-500/20",
      rose: "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20",
      pink: "bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20",
      indigo: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20",
      emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20",
      sky: "bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20",
      fuchsia: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20",
      red: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20",
    };
    const base = colorMap[color] || colorMap["yellow"];
    return active ? base.replace(/\/10/g, "/25") : base;
  };

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    fetchTokens();
  }, [fetchTokens]);

  const openChart = useCallback((token: TokenData, e?: React.MouseEvent) => {
    // Prevent opening chart when clicking action buttons (copy, bscscan link)
    if (e) {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("a")) return;
    }
    setSelectedToken(token);
  }, []);

  const closeChart = useCallback(() => {
    setSelectedToken(null);
  }, []);

  // Close chart on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedToken) {
        closeChart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedToken, closeChart]);

  // Client-side filtering
  const filteredTokens = useMemo(() => {
    let result = [...tokens];

    switch (filterMode) {
      case "gainers":
        result = result.filter((t) => t.priceChange24h !== null && t.priceChange24h > 0);
        break;
      case "losers":
        result = result.filter((t) => t.priceChange24h !== null && t.priceChange24h < 0);
        break;
      case "volume":
        result = result.filter((t) => t.volume24h !== null && t.volume24h > 0);
        result.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
        break;
      case "hot":
        // Hot = high 24h gain with significant volume
        result = result.filter(
          (t) =>
            t.priceChange24h !== null &&
            t.priceChange24h > 5 &&
            t.volume24h !== null &&
            t.volume24h > 100
        );
        result.sort((a, b) => (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0));
        break;
    }

    return result;
  }, [tokens, filterMode]);

  // Stats
  const stats = useMemo(() => {
    const gainers = tokens.filter((t) => t.priceChange24h !== null && t.priceChange24h > 0);
    const losers = tokens.filter((t) => t.priceChange24h !== null && t.priceChange24h < 0);
    const topGainer = gainers.length > 0
      ? gainers.reduce((max, t) => (t.priceChange24h! > max.priceChange24h! ? t : max))
      : null;
    return { gainers: gainers.length, losers: losers.length, topGainer };
  }, [tokens]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortOrder === "desc" ? (
      <ArrowDown className="w-3 h-3 text-yellow-400" />
    ) : (
      <ArrowUp className="w-3 h-3 text-yellow-400" />
    );
  };

  // Build DexScreener chart embed URL
  const chartEmbedUrl = selectedToken
    ? `https://dexscreener.com/bsc/${selectedToken.contractAddress}?embed=1&theme=dark&info=0`
    : "";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Chart Modal */}
      {selectedToken && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeChart}
          />
          {/* Slide-over Panel */}
          <div className="relative w-full max-w-2xl bg-[#0d0d14] border-l border-white/10 flex flex-col animate-slide-in">
            {/* Chart Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                {selectedToken.imageUrl ? (
                  <img
                    src={selectedToken.imageUrl}
                    alt={selectedToken.symbol}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500/30 to-amber-700/30 flex items-center justify-center text-xs font-bold text-yellow-400">
                    {selectedToken.symbol.slice(0, 2)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">{selectedToken.name}</h2>
                    <span className="text-xs text-zinc-500">{selectedToken.symbol}</span>
                    {selectedToken.isFeatured && (
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-sm font-mono text-white">
                      {formatPrice(selectedToken.priceUsd)}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        selectedToken.priceChange24h === null
                          ? "text-zinc-500"
                          : selectedToken.priceChange24h >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {formatPercent(selectedToken.priceChange24h)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={closeChart}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Token Stats Bar */}
            <div className="grid grid-cols-4 gap-2 px-4 py-2 border-b border-white/5 bg-[#0a0a12]">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 mb-0.5">
                  <DollarSign className="w-2.5 h-2.5" />
                  Volume
                </div>
                <p className="text-xs font-semibold text-white">{formatNumber(selectedToken.volume24h)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 mb-0.5">
                  <BarChart3 className="w-2.5 h-2.5" />
                  MCap
                </div>
                <p className="text-xs font-semibold text-white">{formatNumber(selectedToken.marketCap)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 mb-0.5">
                  <Activity className="w-2.5 h-2.5" />
                  Liquidity
                </div>
                <p className="text-xs font-semibold text-white">{formatNumber(selectedToken.liquidity)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 mb-0.5">
                  <Hash className="w-2.5 h-2.5" />
                  DEX
                </div>
                <p className="text-xs font-semibold text-white uppercase">{selectedToken.dex}</p>
              </div>
            </div>

            {/* DexScreener Chart Embed */}
            <div className="flex-1 min-h-0">
              <iframe
                src={chartEmbedUrl}
                className="w-full h-full border-0"
                style={{ minHeight: "400px" }}
                allow="clipboard-write"
                title={`${selectedToken.name} Chart`}
              />
            </div>

            {/* Chart Footer - Actions */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 bg-[#0a0a12]">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                onClick={() => copyAddress(selectedToken.contractAddress)}
              >
                {copiedAddress === selectedToken.contractAddress ? (
                  <>
                    <Check className="w-3 h-3 mr-1.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1.5" />
                    Copy Contract
                  </>
                )}
              </Button>
              <a
                href={selectedToken.bscscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  BscScan
                </Button>
              </a>
              <a
                href={`https://dexscreener.com/bsc/${selectedToken.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300"
                >
                  <BarChart3 className="w-3 h-3 mr-1.5" />
                  DexScreener
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0d0d14]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center">
                <Coins className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-transparent">
                  BSC Screener
                </h1>
                <p className="text-[10px] text-zinc-500 -mt-0.5">BNB Smart Chain BEP-20</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-[10px] text-zinc-500 hidden sm:block">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white hover:bg-white/5"
                onClick={() => fetchTokens(searchQuery || undefined, undefined)}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Search Bar */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name, symbol, or contract address..."
                className="pl-10 pr-10 bg-[#12121a] border-white/10 text-white placeholder:text-zinc-600 focus:border-yellow-500/50 focus:ring-yellow-500/20 h-11"
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              onClick={handleSearch}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-semibold h-11 px-6"
            >
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Quick Search Buttons */}
          <div className="space-y-2">
            {/* Featured tokens */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadToken(UNL_ADDRESS, "UNL")}
                className="bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300"
              >
                <Zap className="w-3 h-3 mr-1" />
                UNL
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadToken(BLCIO_ADDRESS, "Blcio")}
                className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
              >
                <Rocket className="w-3 h-3 mr-1" />
                Blcio
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSearch}
                className="bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>
            {/* Mudrex Category Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {MUDREX_CATEGORIES.map((cat) => (
                <Button
                  key={cat.label}
                  variant="outline"
                  size="sm"
                  onClick={() => searchCategory(cat.query, cat.label)}
                  className={`h-6 text-[11px] px-2.5 rounded-full border ${getCategoryStyle(cat.color, searchQuery === cat.label)}`}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {tokens.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-[#12121a] border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-zinc-500">Total Tokens</span>
              </div>
              <p className="text-xl font-bold text-white">{tokens.length}</p>
            </Card>
            <Card className="bg-[#12121a] border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-zinc-500">Gainers</span>
              </div>
              <p className="text-xl font-bold text-emerald-400">{stats.gainers}</p>
            </Card>
            <Card className="bg-[#12121a] border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-zinc-500">Losers</span>
              </div>
              <p className="text-xl font-bold text-red-400">{stats.losers}</p>
            </Card>
            <Card className="bg-[#12121a] border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-zinc-500">Top Gainer</span>
              </div>
              <p className="text-sm font-bold text-emerald-400 truncate">
                {stats.topGainer ? `${stats.topGainer.symbol} ${formatPercent(stats.topGainer.priceChange24h)}` : "—"}
              </p>
            </Card>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Filter className="w-3 h-3" />
            <span>Filter:</span>
          </div>
          {(["all", "gainers", "losers", "volume", "hot"] as FilterMode[]).map((mode) => (
            <Button
              key={mode}
              variant="ghost"
              size="sm"
              onClick={() => setFilterMode(mode)}
              className={`h-7 text-xs px-3 rounded-full ${
                filterMode === mode
                  ? mode === "hot"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-transparent"
              }`}
            >
              {mode === "all"
                ? "All"
                : mode === "gainers"
                ? "🟢 Gainers"
                : mode === "losers"
                ? "🔴 Losers"
                : mode === "volume"
                ? "📊 Volume"
                : "🔥 Hot"}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-zinc-500">Sort:</span>
            <Select
              value={`${sortField}-${sortOrder}`}
              onValueChange={(val) => {
                const [field, order] = val.split("-") as [SortField, SortOrder];
                setSortField(field);
                setSortOrder(order);
              }}
            >
              <SelectTrigger className="w-44 h-7 text-xs bg-[#12121a] border-white/10 text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#12121a] border-white/10">
                <SelectItem value="priceChange24h-desc">24h Gain ↓</SelectItem>
                <SelectItem value="priceChange24h-asc">24h Gain ↑</SelectItem>
                <SelectItem value="volume24h-desc">Volume ↓</SelectItem>
                <SelectItem value="marketCap-desc">Market Cap ↓</SelectItem>
                <SelectItem value="liquidity-desc">Liquidity ↓</SelectItem>
                <SelectItem value="priceUsd-desc">Price ↓</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/20 p-4">
            <p className="text-red-400 text-sm">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-red-400 hover:bg-red-500/10"
              onClick={() => fetchTokens(searchQuery || undefined)}
            >
              Try Again
            </Button>
          </Card>
        )}

        {/* Token Table */}
        <div className="rounded-xl border border-white/5 bg-[#0d0d14] overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 w-10">#</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Token <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort("priceUsd")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Price <SortIcon field="priceUsd" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort("priceChange24h")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      24h Change <SortIcon field="priceChange24h" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort("volume24h")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Volume 24h <SortIcon field="volume24h" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort("marketCap")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Market Cap <SortIcon field="marketCap" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort("liquidity")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Liquidity <SortIcon field="liquidity" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">DEX</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">Contract</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-6 bg-zinc-800" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32 bg-zinc-800" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 bg-zinc-800 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16 bg-zinc-800 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 bg-zinc-800 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 bg-zinc-800 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 bg-zinc-800 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16 bg-zinc-800 mx-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 bg-zinc-800 mx-auto" /></td>
                      </tr>
                    ))
                  : filteredTokens.map((token, index) => (
                      <tr
                        key={token.contractAddress}
                        onClick={(e) => openChart(token, e)}
                        className={`border-b border-white/5 hover:bg-white/[0.04] transition-colors group cursor-pointer ${
                          token.isFeatured ? "bg-yellow-500/[0.03]" : ""
                        } ${selectedToken?.contractAddress === token.contractAddress ? "bg-yellow-500/[0.06]" : ""}`}
                      >
                        <td className="px-4 py-3 text-sm text-zinc-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {token.imageUrl ? (
                              <img
                                src={token.imageUrl}
                                alt={token.symbol}
                                className="w-7 h-7 rounded-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-500/30 to-amber-700/30 flex items-center justify-center text-[10px] font-bold text-yellow-400">
                                {token.symbol.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-white group-hover:text-yellow-300 transition-colors">
                                  {token.name}
                                </p>
                                {token.isFeatured && (
                                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500">{token.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-mono text-white">
                          {formatPrice(token.priceUsd)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-sm font-semibold ${
                              token.priceChange24h === null
                                ? "text-zinc-500"
                                : token.priceChange24h >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {formatPercent(token.priceChange24h)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-300">
                          {formatNumber(token.volume24h)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-300">
                          {formatNumber(token.marketCap)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-300">
                          {formatNumber(token.liquidity)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-white/5 border-white/10 text-zinc-400"
                          >
                            {token.dex}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs text-zinc-500 font-mono">
                              {truncateAddress(token.contractAddress)}
                            </span>
                            <button
                              onClick={() => copyAddress(token.contractAddress)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-yellow-400"
                            >
                              {copiedAddress === token.contractAddress ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <a
                              href={token.bscscanUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-yellow-400"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 border-b border-white/5">
                    <Skeleton className="h-4 w-32 bg-zinc-800 mb-2" />
                    <Skeleton className="h-3 w-20 bg-zinc-800" />
                  </div>
                ))
              : filteredTokens.map((token, index) => (
                  <div
                    key={token.contractAddress}
                    onClick={(e) => openChart(token, e)}
                    className={`p-4 border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                      token.isFeatured ? "bg-yellow-500/[0.03]" : ""
                    } ${selectedToken?.contractAddress === token.contractAddress ? "bg-yellow-500/[0.06]" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-5">{index + 1}</span>
                        {token.imageUrl ? (
                          <img
                            src={token.imageUrl}
                            alt={token.symbol}
                            className="w-6 h-6 rounded-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-500/30 to-amber-700/30 flex items-center justify-center text-[9px] font-bold text-yellow-400">
                            {token.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-white">{token.name}</span>
                          {token.isFeatured && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                          <span className="text-xs text-zinc-500 ml-0.5">{token.symbol}</span>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          token.priceChange24h === null
                            ? "text-zinc-500"
                            : token.priceChange24h >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {formatPercent(token.priceChange24h)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 ml-7">
                      <span className="font-mono text-white">{formatPrice(token.priceUsd)}</span>
                      <div className="flex gap-3">
                        <span>Vol: {formatNumber(token.volume24h)}</span>
                        <span>MC: {formatNumber(token.marketCap)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs ml-7">
                      <span className="text-zinc-600 font-mono">{truncateAddress(token.contractAddress)}</span>
                      <a
                        href={token.bscscanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-yellow-500/70 hover:text-yellow-400"
                      >
                        BscScan ↗
                      </a>
                    </div>
                  </div>
                ))}
          </div>

          {/* Empty State */}
          {!loading && filteredTokens.length === 0 && !error && (
            <div className="py-16 text-center">
              <Coins className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No tokens found</p>
              <p className="text-zinc-600 text-xs mt-1">Try a different search term or filter</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-yellow-400 hover:bg-yellow-500/10"
                onClick={clearSearch}
              >
                Reset Filters
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-600 pt-4 pb-8">
          <div className="flex items-center gap-1.5">
            <span>Powered by</span>
            <a
              href="https://dexscreener.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-500/70 hover:text-yellow-400"
            >
              DexScreener
            </a>
            <span>&</span>
            <a
              href="https://bscscan.com/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-500/70 hover:text-yellow-400"
            >
              BscScan
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Data refreshes automatically every 60s</span>
          </div>
        </div>
      </main>
    </div>
  );
}
