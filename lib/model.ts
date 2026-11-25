// lib/model.ts — the radar's model: one sealed DefiLlama snapshot in, one ranked board out.
//
// The value model is anchored on the snapshot's own market. A protocol whose token already trades
// carries a market cap, so the traded protocols state what the market pays per dollar of TVL. A
// pre-token protocol's implied value is its TVL priced at the live anchor of its own category —
// the median market-cap/TVL ratio of that category's traded protocols with at least $25M of TVL.
// A young category with too few traded protocols of its own (the risk curators are the case here:
// nearly all of them are pre-token themselves) falls back to the anchor of its economic family —
// the categories that make money the same way, grouped by a rule over category names — and only
// then to the global anchor. The price is then adjusted by three factors the snapshot itself
// supplies: its seven-day TVL momentum, how long it has run with no token, and how many chains it
// is deployed on. No protocol is named or special-cased anywhere: one function prices every row,
// and the dashboard prints the anchor table it used, so a reader can re-derive every number.
//
// The board covers the snapshot's watchlist in full (the floor, never the ceiling) and adds the
// strongest pre-token protocols below the floor: the early rows a radar exists to find. A protocol
// is pre-token when the snapshot records no token for it — no market cap, no CoinGecko id, no
// symbol. Traded protocols are never ranked; the dashboard shows the largest of them apart, as the
// anchor set the model reads its prices from.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, printed on the dashboard so the board can be re-derived by hand. */
export interface ModelConstants {
  anchor_min: number;
  anchor_max: number;
  anchor_min_tvl: number;
  anchor_min_samples: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  age_floor: number;
  age_range: number;
  age_full_days: number;
  age_unknown_mult: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
}

export const MODEL: ModelConstants = {
  anchor_min: 0.05,
  anchor_max: 3,
  anchor_min_tvl: 25_000_000,
  anchor_min_samples: 3,
  growth_weight: 0.6,
  growth_floor: -40,
  growth_cap: 80,
  age_floor: 0.8,
  age_range: 0.35,
  age_full_days: 1460,
  age_unknown_mult: 0.9,
  breadth_per_chain: 0.02,
  breadth_max_extra: 8,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'anchor-3';

/** How many early pre-token protocols below the watchlist floor the board adds, by TVL. */
export const EARLY_ROWS = 180;

/** How many traded protocols the dashboard's anchor-set view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's live anchor: the multiple the market pays per TVL dollar there, and its sample size. */
export interface Anchor {
  category: string;
  multiple: number;
  samples: number;
  basis: 'category' | 'family' | 'global';
  family: string | null;
}

/** The price of one protocol, broken into the factors that made it. */
export interface Pricing {
  anchor: number;
  anchor_basis: 'category' | 'family' | 'global';
  anchor_samples: number;
  anchor_family: string | null;
  growth_mult: number;
  age_mult: number;
  breadth_mult: number;
  age_days: number | null;
  implied: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  pricing: {
    anchor_multiple: number;
    anchor_basis: 'category' | 'family' | 'global';
    anchor_samples: number;
    anchor_family: string | null;
    growth_multiplier: number;
    age_multiplier: number;
    breadth_multiplier: number;
  };
  farm_steps: string[];
}

/** A traded protocol, shown apart from the board: the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  symbol: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  ratio: number;
  change_7d: number | null;
}

/** Everything the dashboard renders: the board, the anchor set and the model that priced it. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model: ModelConstants;
  anchors: Anchor[];
  global_anchor: number;
  counts: { protocols: number; pre_token: number; live: number; watchlist: number; board: number; early: number };
  rows: BoardRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

const bySlugOrder = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Whether the snapshot records no token for a protocol: no market cap, no CoinGecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * Whether a pre-token protocol below the floor may be an early board row: not an exchange, not a
 * versioned pool of another protocol, and not named as a wrapped or staked product or with an
 * exchange's own brand — the same derivative shapes the watchlist's rule sets aside.
 */
export function isEarlyCandidate(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_PREFIX.test(p.name);
}

/**
 * The economic family a category belongs to, by a rule over the category's name: the categories
 * that make money the same way. A category in no family falls back to the global anchor directly.
 */
export function familyOf(category: string | null): string | null {
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized')) return 'lending';
  if (c.includes('dex') || c.includes('liquidity')) return 'trading';
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('farm') || c.includes('manager') || c.includes('basis') || c.includes('indexes')) return 'yield';
  if (c.includes('staking') || c.includes('restak')) return 'staking';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('derivative') || c.includes('option') || c.includes('synthetic') || c.includes('interest rate')) return 'derivatives';
  if (c.includes('stable') || c.includes('algo')) return 'stable';
  if (c.includes('rwa')) return 'rwa';
  return null;
}

/**
 * The live anchors, resolved per category: the category's own median market-cap/TVL ratio when at
 * least the model's minimum of its established traded protocols (TVL at or above the anchor floor)
 * carries one, else its family's median over the same established set, else the global median.
 * Exchanges are left out of the anchor universe: an exchange's TVL is customer balances, not a
 * product's locked value, so its ratio prices nothing else. Ratios are clamped to the model's band.
 */
export function computeAnchors(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, Anchor>; global: Anchor } {
  const traded = snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX');
  const established = traded.filter((p) => p.tvl_usd >= model.anchor_min_tvl);
  const ratio = (p: SnapshotProtocol): number => p.mcap_usd! / p.tvl_usd;
  const globalMultiple = clamp(median(established.map(ratio)), model.anchor_min, model.anchor_max);
  const global: Anchor = { category: '(all categories)', multiple: round4(globalMultiple), samples: established.length, basis: 'global', family: null };
  const familyPools = new Map<string, SnapshotProtocol[]>();
  for (const p of established) {
    const family = familyOf(p.category);
    if (family === null) continue;
    const pool = familyPools.get(family) ?? [];
    pool.push(p);
    familyPools.set(family, pool);
  }
  const byCategory = new Map<string, Anchor>();
  const categories = new Set(snapshot.protocols.map((p) => p.category ?? '(none)'));
  for (const category of categories) {
    const own = established.filter((p) => (p.category ?? '(none)') === category);
    if (own.length >= model.anchor_min_samples) {
      byCategory.set(category, { category, multiple: round4(clamp(median(own.map(ratio)), model.anchor_min, model.anchor_max)), samples: own.length, basis: 'category', family: familyOf(category === '(none)' ? null : category) });
      continue;
    }
    const family = familyOf(category === '(none)' ? null : category);
    const pool = family === null ? [] : (familyPools.get(family) ?? []);
    if (family !== null && pool.length >= model.anchor_min_samples) {
      byCategory.set(category, { category, multiple: round4(clamp(median(pool.map(ratio)), model.anchor_min, model.anchor_max)), samples: pool.length, basis: 'family', family });
      continue;
    }
    byCategory.set(category, { category, multiple: global.multiple, samples: global.samples, basis: 'global', family: null });
  }
  return { byCategory, global };
}

/** The price of one pre-token protocol under the model: its TVL at its category's anchor, adjusted. */
export function price(p: SnapshotProtocol, asOf: string, anchors: { byCategory: Map<string, Anchor>; global: Anchor }, model: ModelConstants = MODEL): Pricing {
  const own = anchors.byCategory.get(p.category ?? '(none)');
  const anchor = own ?? anchors.global;
  const growthPct = clamp(typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : 0, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const age = ageDays(asOf, p.listed_at);
  const ageMult = age === null ? model.age_unknown_mult : model.age_floor + model.age_range * Math.sqrt(Math.min(age, model.age_full_days) / model.age_full_days);
  const breadthMult = 1 + model.breadth_per_chain * Math.min(Math.max(p.chains.length - 1, 0), model.breadth_max_extra);
  const implied = Math.max(1, Math.round(p.tvl_usd * anchor.multiple * growthMult * ageMult * breadthMult));
  return {
    anchor: anchor.multiple,
    anchor_basis: anchor.basis,
    anchor_samples: anchor.samples,
    anchor_family: anchor.family,
    growth_mult: growthMult,
    age_mult: ageMult,
    breadth_mult: breadthMult,
    age_days: age,
    implied,
  };
}

/** The board: every watchlist protocol, plus the strongest early candidates below the floor, priced and ranked. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const anchors = computeAnchors(snapshot, model);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isEarlyCandidate(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || bySlugOrder(a.slug, b.slug))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const watchlist = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => ({ p, pricing: price(p, snapshot.as_of, anchors, model) }));
  scored.sort((a, b) => b.pricing.implied - a.pricing.implied || bySlugOrder(a.p.slug, b.p.slug));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    age_days: s.pricing.age_days,
    watchlist: watchlist.has(s.p.slug),
    implied_value_usd: s.pricing.implied,
    pricing: {
      anchor_multiple: s.pricing.anchor,
      anchor_basis: s.pricing.anchor_basis,
      anchor_samples: s.pricing.anchor_samples,
      anchor_family: s.pricing.anchor_family,
      growth_multiplier: round4(s.pricing.growth_mult),
      age_multiplier: round4(s.pricing.age_mult),
      breadth_multiplier: round4(s.pricing.breadth_mult),
    },
    farm_steps: farmSteps(s.p, s.pricing.age_days),
  }));
}

/** The traded protocols, by market cap: the anchor set, shown apart from the board. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || bySlugOrder(a.slug, b.slug))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      symbol: p.symbol,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      ratio: round4(p.mcap_usd! / p.tvl_usd),
      change_7d: p.change_7d,
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; data: RadarData } {
  const board = buildBoard(snapshot, model);
  const anchors = computeAnchors(snapshot, model);
  const live = liveRows(snapshot);
  const data: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model,
    anchors: [...anchors.byCategory.values()].sort((a, b) => b.samples - a.samples || bySlugOrder(a.category, b.category)),
    global_anchor: anchors.global.multiple,
    counts: {
      protocols: snapshot.protocols.length,
      pre_token: snapshot.protocols.filter(isPreToken).length,
      live: snapshot.protocols.filter((p) => !isPreToken(p)).length,
      watchlist: snapshot.watchlist.length,
      board: board.length,
      early: board.filter((r) => !r.watchlist).length,
    },
    rows: board,
    live,
  };
  return { board, data };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, shared value, farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100 a board needs`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) return 'every row shares one implied value: a board that ranks nothing by value is not a ranking';
  for (const r of board) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const trimmed = s.trim();
      if (trimmed.length < 20 || trimmed.length > 600) return `${r.slug} has a farm step of ${trimmed.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(data: RadarData): string {
  return `window.RADAR=${JSON.stringify(data)};\n`;
}

// ---------------------------------------------------------------- farm plans

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A rough gas budget for one transaction on a chain, from the chain's name. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return '$8-15';
  if (chain === 'Solana') return 'under $0.10';
  if (chain.includes('BNB')) return 'about $0.30';
  if (['Arbitrum', 'Base', 'Optimism', 'Polygon', 'zkSync Era', 'Linea', 'Scroll', 'Mantle', 'Blast', 'Mode', 'Taiko', 'Starknet'].includes(chain)) return '$0.20-2';
  return '$1-5';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(tvl: number): number {
  if (tvl >= 1_000_000_000) return 500;
  if (tvl >= 250_000_000) return 250;
  if (tvl >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 540) return 45;
  return 30;
}

/** The category's core farming action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${n} on ${chain} as collateral and leave the position open`;
  if (c.includes('dex') || c.includes('liquidity')) return `Add $${capital} of liquidity to ${n}'s busiest pool on ${chain} and keep the position open`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${n}, then use the bridged funds in one app on that chain`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${n} on ${chain} and keep the receipt token in the wallet`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('basis')) return `Deposit $${capital} of USDC as margin on ${n} and open one small hedged position`;
  if (c.includes('prediction')) return `Fund a ${n} account with $${capital} and take one small position in a liquid market`;
  if (c.includes('stable') || c.includes('algo')) return `Mint or deposit $${capital} of the stable asset through ${n} on ${chain} and hold it in the wallet`;
  if (c.includes('rwa')) return `Subscribe $${capital} to ${n}'s yield asset on ${chain} and hold it in the wallet`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${n} for a position you already hold and keep the policy to expiry`;
  if (c.includes('launchpad')) return `Register on ${n} and complete one launch participation with up to $${capital}`;
  return `Deposit $${capital} of USDC into ${n}'s main product on ${chain} and keep the position open`;
}

/** The category's second, repeating action: the cadence that makes the activity count. */
function cadenceFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Once a week, borrow about 30% against the collateral on ${n}, hold it a day and repay it in full`;
  if (c.includes('dex') || c.includes('liquidity')) return `Once a week, route one swap of about $25 through ${n} and rebalance the liquidity position if it drifts`;
  if (c.includes('bridge')) return `Once a week, bridge about $25 back or onward through ${n} so both directions appear in the wallet's history`;
  if (c.includes('staking') || c.includes('restak')) return `Once a week, claim any staking rewards on ${n} and restake them into the same position`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('basis')) return `Once a week, open and close one small hedged trade on ${n} so the account shows steady volume`;
  return `Once a week, repeat the core action on ${n} at about a tenth of the position's size`;
}

/** The category's exit note: how the position unwinds when the farm ends. */
function exitFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('staking') || c.includes('restak')) return `start the unstaking period on ${n} early, since unstaking can take days before the asset is liquid again`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `repay any open borrow on ${n} first, then withdraw the collateral in one transaction`;
  if (c.includes('dex') || c.includes('liquidity')) return `remove the liquidity from ${n} and swap the proceeds back to a stable asset in the same session`;
  return `withdraw the position from ${n} in one session and swap the proceeds back to a stable asset`;
}

/**
 * A protocol's farm plan: six steps, each an action with what it costs and how long it takes,
 * derived from the protocol's own record (category, chains, TVL, age), never from a list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const chain = chainOf(p);
  const capital = capitalFor(p.tvl_usd);
  const gas = gasFor(chain);
  const hold = holdDaysFor(age);
  const steps = [
    `Set up a fresh wallet for ${p.name} alone, write its seed phrase on paper and keep it offline; fund it on ${chain} with the position capital plus gas. Cost: ${gas} of gas to fund and make the first transaction. Time: 10 minutes.`,
    `${actionFor(p, capital, chain)}. Cost: $${capital} of capital and about ${gas} of gas. Time: 15 minutes to set up.`,
    `${cadenceFor(p)}. Cost: about ${gas} of gas a week. Time: 10 minutes a week.`,
    `Hold the position for at least ${hold} days, checking the wallet's balance and the protocol's own announcements once a week. Cost: the $${capital} stays in the position for the whole window. Time: ${hold} days.`,
    `Open ${p.name}'s own points or rewards page from the link on its official site and check the wallet's standing; claim only from that page and never pay a fee to claim. Cost: nothing to check. Time: 10 minutes.`,
    `Keep a farm log with the wallet address, every date and transaction hash; when the window ends, ${exitFor(p)}. Cost: about ${gas} of gas to unwind. Time: 20 minutes.`,
  ];
  return steps.map((s) => (s.length > 600 ? `${s.slice(0, 596)}...` : s));
}
