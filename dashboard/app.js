/* Pre-Token Radar — a static page over window.RADAR (written beside it as data.js by main.ts).
   Board, detail view for every protocol, filters and sorting; no network, no framework. */
'use strict';

const D = window.RADAR;
const app = document.getElementById('app');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtUsd = (n) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n}`;
};
const fmtFull = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtPct = (n) => (n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`);
const pctClass = (n) => (n === null || n === undefined || n === 0 ? '' : n > 0 ? 'up' : 'down');
const fmtAge = (days) => (days === null ? 'unknown' : days >= 365 ? `${(days / 365).toFixed(1)} y` : `${days} d`);
const bySlug = new Map(D.rows.map((r) => [r.slug, r]));

const state = { q: '', cat: '', chain: '', min: 0, wl: false, sort: 'rank', dir: 1 };

function header(active) {
  const c = D.counts;
  return `<header class="hero">
    <div class="eyebrow">Token launch radar · model ${esc(D.model_version)}</div>
    <h1>Pre-Token Radar</h1>
    <p class="lede">Every protocol in the snapshot that records no token yet, ranked by what a launch
    would be worth if its record stayed as it is. Prices are anchored on the snapshot's own market:
    each category's traded protocols state what a TVL dollar is worth there, and the board prices
    the untraded ones from those anchors — never from a list of names.</p>
    <div class="stats">
      <div class="stat"><b>${c.protocols}</b><span>protocols scanned</span></div>
      <div class="stat"><b>${c.watchlist}</b><span>watchlist covered</span></div>
      <div class="stat"><b>${c.board}</b><span>board rows</span></div>
      <div class="stat"><b>${c.early}</b><span>early, below the floor</span></div>
      <div class="stat"><b>${c.live}</b><span>already trading, set aside</span></div>
      <div class="stat"><b>${esc(D.as_of)}</b><span>snapshot date</span></div>
    </div>
  </header>${active === 'board' ? modelPanel() : ''}`;
}

function modelPanel() {
  const m = D.model;
  const anchors = D.anchors.slice(0, 12);
  return `<section class="panel">
    <h2>How a price is made</h2>
    <p class="formula">implied = TVL × category anchor × growth × age × breadth</p>
    <p><b>Anchor</b>: the median market-cap / TVL of the category's traded protocols with at least
    ${fmtUsd(m.anchor_min_tvl)} of TVL. A category with fewer than ${m.anchor_min_samples} of its own falls back to
    its economic family's median (categories that earn the same way), then to the global anchor of
    <span class="num">${D.global_anchor}×</span>; anchors are clamped to ${m.anchor_min}–${m.anchor_max}× and
    exchanges are left out of the anchor set.
    <b>Growth</b>: 1 + ${m.growth_weight} × the 7-day TVL change, clamped to ${m.growth_floor}%…${m.growth_cap}%.
    <b>Age</b>: ${m.age_floor} rising to ${m.age_floor + m.age_range} over ${m.age_full_days} days with no token
    (${m.age_unknown_mult} when the listing date is unknown). <b>Breadth</b>: +${m.breadth_per_chain * 100}% per extra
    chain, up to ${m.breadth_max_extra}. Every row's detail view shows its own four factors.</p>
    <table class="mini"><thead><tr><th>Category anchor</th><th class="n">Multiple</th><th class="n">Traded protocols</th><th>Basis</th></tr></thead>
    <tbody>${anchors.map((a) => `<tr><td>${esc(a.category)}</td><td class="n">${a.multiple}×</td><td class="n">${a.samples}</td><td>${a.basis === 'category' ? 'its own traded set' : a.basis === 'family' ? `${esc(a.family ?? '')} family` : 'global'}</td></tr>`).join('')}</tbody></table>
  </section>`;
}

function controls() {
  const cats = [...new Set(D.rows.map((r) => r.category ?? '(none)'))].sort();
  const chains = [...new Set(D.rows.flatMap((r) => r.chains))].sort();
  const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label ?? v)}</option>`;
  return `<div class="controls">
    <div><label for="q">Search</label><input type="search" id="q" placeholder="Name or slug" value="${esc(state.q)}"></div>
    <div><label for="cat">Category</label><select id="cat">${opt('', state.cat, 'All categories')}${cats.map((c) => opt(c, state.cat)).join('')}</select></div>
    <div><label for="chain">Chain</label><select id="chain">${opt('', state.chain, 'All chains')}${chains.map((c) => opt(c, state.chain)).join('')}</select></div>
    <div><label for="min">Implied value at least</label><select id="min">
      ${[[0, 'Any'], [1e7, '$10M'], [5e7, '$50M'], [1e8, '$100M'], [5e8, '$500M'], [1e9, '$1B']].map(([v, l]) => opt(String(v), String(state.min), l)).join('')}
    </select></div>
    <div><label for="sort">Sort by</label><select id="sort">
      ${[['rank', 'Rank'], ['implied', 'Implied value'], ['tvl', 'TVL'], ['change', '7d change'], ['age', 'Age'], ['anchor', 'Anchor']].map(([v, l]) => opt(v, state.sort, l)).join('')}
    </select></div>
    <label class="check"><input type="checkbox" id="wl"${state.wl ? ' checked' : ''}> Watchlist only</label>
  </div>`;
}

function visibleRows() {
  const q = state.q.trim().toLowerCase();
  let rows = D.rows.filter((r) =>
    (state.cat === '' || (r.category ?? '(none)') === state.cat) &&
    (state.chain === '' || r.chains.includes(state.chain)) &&
    r.implied_value_usd >= state.min &&
    (!state.wl || r.watchlist) &&
    (q === '' || r.name.toLowerCase().includes(q) || r.slug.includes(q)));
  const key = { rank: (r) => r.rank, implied: (r) => r.implied_value_usd, tvl: (r) => r.tvl_usd, change: (r) => r.change_7d ?? -1e9, age: (r) => r.age_days ?? -1, anchor: (r) => r.pricing.anchor_multiple }[state.sort];
  rows = rows.sort((a, b) => (key(a) - key(b)) * (state.sort === 'rank' ? 1 : -state.dir) || (a.slug < b.slug ? -1 : 1));
  return rows;
}

function boardView() {
  const rows = visibleRows();
  const body = rows.map((r) => `<tr data-slug="${esc(r.slug)}">
    <td class="n">${r.rank}</td>
    <td><span class="pname">${esc(r.name)}</span>${r.watchlist ? '<span class="chip wl">watchlist</span>' : '<span class="chip">early</span>'}<br><span class="pslug">${esc(r.slug)}</span></td>
    <td>${esc(r.category ?? '—')}</td>
    <td class="hideS">${esc(r.chains.slice(0, 3).join(', '))}${r.chains.length > 3 ? ` +${r.chains.length - 3}` : ''}</td>
    <td class="n">${fmtUsd(r.tvl_usd)}</td>
    <td class="n ${pctClass(r.change_7d)}">${fmtPct(r.change_7d)}</td>
    <td class="n hideS">${fmtAge(r.age_days)}</td>
    <td class="n hideS">${r.pricing.anchor_multiple}×</td>
    <td class="n value">${fmtUsd(r.implied_value_usd)}</td>
  </tr>`).join('');
  app.innerHTML = `${header('board')}${controls()}
    <p class="count">${rows.length} of ${D.counts.board} protocols shown. Click a row for its detail view and farm plan.</p>
    <table class="board"><thead><tr>
      <th class="n" data-sort="rank">#</th><th data-sort="rank">Protocol</th><th>Category</th><th class="hideS">Chains</th>
      <th class="n" data-sort="tvl">TVL</th><th class="n" data-sort="change">7d</th><th class="n hideS" data-sort="age">Age</th>
      <th class="n hideS" data-sort="anchor">Anchor</th><th class="n" data-sort="implied">Implied value</th>
    </tr></thead><tbody>${body || '<tr><td colspan="9" class="muted">No protocol matches these filters.</td></tr>'}</tbody></table>
    ${liveSection()}${footer()}`;
  app.setAttribute('aria-busy', 'false');
  wireBoard();
}

function liveSection() {
  const rows = D.live.map((r) => `<tr>
    <td><span class="pname">${esc(r.name)}</span> <span class="pslug">${esc(r.symbol ?? '')}</span></td>
    <td>${esc(r.category ?? '—')}</td><td class="n">${fmtUsd(r.mcap_usd)}</td><td class="n">${fmtUsd(r.tvl_usd)}</td><td class="n">${r.ratio}×</td>
  </tr>`).join('');
  return `<section class="panel"><h2>Already trading — the anchor set, not the board</h2>
  <p>These protocols' tokens trade, so the market has priced them and the radar does not rank them.
  Their market-cap / TVL ratios are the anchors the board's prices are read from; the largest are:</p>
  <table class="mini"><thead><tr><th>Protocol</th><th>Category</th><th class="n">Market cap</th><th class="n">TVL</th><th class="n">Mcap / TVL</th></tr></thead>
  <tbody>${rows}</tbody></table></section>`;
}

function footer() {
  return `<footer>
    <p>Data: ${esc(D.source)}. The watchlist floor is ${fmtUsd(D.floor_usd)} of TVL; the board covers all
    ${D.counts.watchlist} watchlist protocols and adds ${D.counts.early} early ones below it.</p>
    <p>An implied value is this model's claim about what a launch would be worth if the protocol's record
    stayed as it is — not a prediction that a token will be issued, and not a figure any protocol states.
    The snapshot records no token for a board protocol; that is DefiLlama's record, not proof none exists.</p>
  </footer>`;
}

function detailView(slug) {
  const r = bySlug.get(slug);
  if (!r) { boardView(); return; }
  const p = r.pricing;
  const anchorNote = p.anchor_basis === 'category'
    ? `the median of ${p.anchor_samples} traded ${esc(r.category ?? '')} protocols`
    : p.anchor_basis === 'family'
      ? `the ${esc(p.anchor_family ?? '')} family median of ${p.anchor_samples} traded protocols (too few traded ${esc(r.category ?? '')} protocols to anchor on)`
      : `the global median of ${p.anchor_samples} traded protocols (no traded ${esc(r.category ?? '')} set to anchor on)`;
  app.innerHTML = `${header('detail')}
  <a class="back" href="#/">&larr; Back to the board</a>
  <div class="dhead"><h1>${esc(r.name)}</h1>
    ${r.watchlist ? '<span class="chip wl">on the watchlist</span>' : '<span class="chip">early — below the watchlist floor</span>'}
    <span class="chip">records no token</span></div>
  <p class="muted">${esc(r.slug)} · ${esc(r.category ?? 'no category')} · rank #${r.rank} of ${D.counts.board} by implied value</p>
  <div class="grid">
    <div class="cell"><span>Implied value</span><b class="value">${fmtFull(r.implied_value_usd)}</b></div>
    <div class="cell"><span>TVL</span><b>${fmtFull(r.tvl_usd)}</b></div>
    <div class="cell"><span>7d TVL change</span><b class="${pctClass(r.change_7d)}">${fmtPct(r.change_7d)}</b></div>
    <div class="cell"><span>Age with no token</span><b>${r.age_days === null ? 'unknown' : `${r.age_days} days`}</b></div>
    <div class="cell"><span>Tracked since</span><b>${esc(r.listed_at ?? 'unknown')}</b></div>
    <div class="cell"><span>Chains</span><b>${r.chains.length || '—'}</b></div>
  </div>
  <section class="panel"><h2>How this price is made</h2>
    <table class="breakdown">
      <tr><td>TVL (the snapshot's figure)</td><td class="n">${fmtFull(r.tvl_usd)}</td></tr>
      <tr><td>× anchor — ${anchorNote}</td><td class="n">${p.anchor_multiple}×</td></tr>
      <tr><td>× growth — 7-day TVL change of ${fmtPct(r.change_7d)}</td><td class="n">${p.growth_multiplier}×</td></tr>
      <tr><td>× age — ${r.age_days === null ? 'listing date unknown' : `${r.age_days} days with no token`}</td><td class="n">${p.age_multiplier}×</td></tr>
      <tr><td>× breadth — deployed on ${r.chains.length} chain${r.chains.length === 1 ? '' : 's'}${r.chains.length ? ` (${esc(r.chains.join(', '))})` : ''}</td><td class="n">${p.breadth_multiplier}×</td></tr>
      <tr class="total"><td>Implied value</td><td class="n">${fmtFull(r.implied_value_usd)}</td></tr>
    </table>
  </section>
  <section class="panel"><h2>Farm plan</h2>
    <p>What to do before any launch, in order. Costs and times are the plan's own estimates for one wallet.</p>
    <ol class="steps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
  </section>
  <section class="panel"><h2>The record</h2>
    <p>As of ${esc(D.as_of)} the snapshot records no token for ${esc(r.name)}: no market cap, no CoinGecko id and
    no symbol. That is DefiLlama's record, not proof that no token exists — check the protocol's own site
    before acting on this page.</p>
  </section>${footer()}`;
  app.setAttribute('aria-busy', 'false');
  window.scrollTo(0, 0);
}

function wireBoard() {
  const on = (id, ev, fn) => { const n = document.getElementById(id); if (n) n.addEventListener(ev, fn); };
  on('q', 'input', (e) => { state.q = e.target.value; refreshTable(); });
  on('cat', 'change', (e) => { state.cat = e.target.value; refreshTable(); });
  on('chain', 'change', (e) => { state.chain = e.target.value; refreshTable(); });
  on('min', 'change', (e) => { state.min = Number(e.target.value); refreshTable(); });
  on('sort', 'change', (e) => { state.sort = e.target.value; refreshTable(); });
  on('wl', 'change', (e) => { state.wl = e.target.checked; refreshTable(); });
  document.querySelectorAll('th[data-sort]').forEach((th) => th.addEventListener('click', () => {
    const k = th.getAttribute('data-sort');
    if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = 1; }
    refreshTable();
  }));
  wireRows();
}

function wireRows() {
  document.querySelectorAll('tr[data-slug]').forEach((tr) => tr.addEventListener('click', () => {
    location.hash = `#/p/${tr.getAttribute('data-slug')}`;
  }));
}

/* Re-render only the table body and count, so typing in the search box keeps its focus. */
function refreshTable() {
  const rows = visibleRows();
  const tbody = document.querySelector('table.board tbody');
  const count = document.querySelector('.count');
  if (!tbody || !count) { boardView(); return; }
  const fresh = document.createElement('tbody');
  fresh.innerHTML = rows.map((r) => `<tr data-slug="${esc(r.slug)}">
    <td class="n">${r.rank}</td>
    <td><span class="pname">${esc(r.name)}</span>${r.watchlist ? '<span class="chip wl">watchlist</span>' : '<span class="chip">early</span>'}<br><span class="pslug">${esc(r.slug)}</span></td>
    <td>${esc(r.category ?? '—')}</td>
    <td class="hideS">${esc(r.chains.slice(0, 3).join(', '))}${r.chains.length > 3 ? ` +${r.chains.length - 3}` : ''}</td>
    <td class="n">${fmtUsd(r.tvl_usd)}</td>
    <td class="n ${pctClass(r.change_7d)}">${fmtPct(r.change_7d)}</td>
    <td class="n hideS">${fmtAge(r.age_days)}</td>
    <td class="n hideS">${r.pricing.anchor_multiple}×</td>
    <td class="n value">${fmtUsd(r.implied_value_usd)}</td>
  </tr>`).join('') || '<tr><td colspan="9" class="muted">No protocol matches these filters.</td></tr>';
  tbody.replaceWith(fresh);
  count.textContent = `${rows.length} of ${D.counts.board} protocols shown. Click a row for its detail view and farm plan.`;
  wireRows();
}

function route() {
  const h = location.hash;
  if (h.startsWith('#/p/')) { detailView(decodeURIComponent(h.slice(4))); return; }
  if (h.startsWith('#/f/')) {
    const cat = decodeURIComponent(h.slice(4));
    if ([...new Set(D.rows.map((r) => r.category ?? '(none)'))].includes(cat)) state.cat = cat;
  }
  boardView();
}

window.addEventListener('hashchange', route);
route();
