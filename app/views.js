// The four surfaces (plus a top-accounts bonus): each renders into #view from
// one public API call, then sets window.__shotReady so screenshots wait for
// real data. Lists are paginated, views update in place, and every repeated
// fetch goes through the ETag cache in api.js.

import { getBoard, getBounty, getLeaderboard, getProfile, getRankings, cacheNote } from './api.js';
import { esc, money, money0, dateShort, dateTime, timeLeft, isOpen, isClosingSoon, renderMarkdown } from './format.js';

const PAGE_SIZE = 25;

function loadingHtml(what) {
  return `<p class="loading" role="status">Loading ${esc(what)}…</p>`;
}

function errorHtml(err) {
  const msg = err && err.status === 404
    ? 'Not found on make.fun.'
    : 'Could not reach the make.fun API. Check your connection and try again.';
  return `<p class="error" role="alert">${esc(msg)}</p><p><a class="btn ghost" href="#/">Back to the board</a></p>`;
}

function metaHtml(result, extra = '') {
  return `<p class="meta">${esc(cacheNote(result))}${extra ? ' · ' + extra : ''}</p>`;
}

/**
 * An image URL from an API answer: relative paths live on make.fun; a few
 * answers carry an absolute URL, sometimes with the colon after https missing
 * ("https//…"), which is repaired here. Images the API points at may load
 * from where they point.
 */
function apiImageUrl(value) {
  if (!value) return null;
  if (value.startsWith('/')) return 'https://make.fun' + value;
  if (value.startsWith('https//')) return 'https://' + value.slice(7);
  if (value.startsWith('http//')) return 'http://' + value.slice(6);
  return value;
}

/** A bounty card for the board: pot, fee, time left, entries — the facts a visitor scans for. */
function bountyCard(b) {
  const open = isOpen(b.deadline);
  const soon = isClosingSoon(b.deadline);
  const state = open ? (soon ? 'closing' : 'open') : 'closed';
  const fee = b.entryFeeUsd == null ? 'Free to enter' : `${money(b.entryFeeUsd)} entry fee`;
  const pot = b.potUsd != null ? money(b.potUsd) : money0(b.rewardAmount);
  const firstLine = (b.description || '').split('\n')[0];
  const excerpt = firstLine.length > 140 ? firstLine.slice(0, 137).replace(/\s+\S*$/, '') + '…' : firstLine;
  return `<article class="card">
    <h3><a href="#/bounty/${esc(b.slug)}">${esc(b.title)}</a></h3>
    <div class="tagrow">
      <span class="tag">${esc(b.category || 'Bounty')}</span>
      ${b.sponsor ? `<span>by ${esc(b.sponsor.name)}</span>` : ''}
    </div>
    <div class="pot">${pot} <small>live pot</small></div>
    <div class="facts">
      <span><span class="lbl">Fee</span> <b>${esc(fee)}</b></span>
      <span><span class="lbl">Entries</span> <b>${Number(b.submissionCount || 0).toLocaleString('en-US')}</b></span>
    </div>
    <div class="facts">
      <span class="${state}" data-deadline="${esc(b.deadline)}">${esc(timeLeft(b.deadline))}</span>
      <span class="lbl">· ends ${esc(dateShort(b.deadline))}</span>
    </div>
    <p class="desc">${esc(excerpt)}</p>
    <div><a href="#/bounty/${esc(b.slug)}/leaderboard">Leaderboard →</a></div>
  </article>`;
}

// ---------------------------------------------------------------- board ---

const boardState = { filter: 'all', sort: 'deadline', query: '' };

function boardFiltered(items) {
  const q = boardState.query.trim().toLowerCase();
  let list = items.slice();
  if (boardState.filter === 'open') list = list.filter((b) => isOpen(b.deadline));
  if (boardState.filter === 'closing') list = list.filter((b) => isClosingSoon(b.deadline));
  if (boardState.filter === 'closed') list = list.filter((b) => !isOpen(b.deadline));
  if (q) {
    list = list.filter((b) =>
      [b.title, b.category, b.slug, ...(b.skills || [])].join(' ').toLowerCase().includes(q));
  }
  if (boardState.sort === 'pot') list.sort((a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0));
  else if (boardState.sort === 'entries') list.sort((a, b) => (b.submissionCount || 0) - (a.submissionCount || 0));
  else list.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  return list;
}

export async function renderBoard(view) {
  view.innerHTML = `<h1>Live bounties</h1>${loadingHtml('the bounty board')}`;
  window.__shotReady = false;
  let result;
  try {
    result = await getBoard();
  } catch (err) {
    view.innerHTML = `<h1>Live bounties</h1>` + errorHtml(err);
    window.__shotReady = true;
    return;
  }
  const items = result.data.items || [];
  const openCount = items.filter((b) => isOpen(b.deadline)).length;
  const totalPot = items.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const paint = () => {
    const list = boardFiltered(items);
    view.innerHTML = `<h1>Live bounties</h1>
      <p class="sub">${openCount} open · ${money0(totalPot)} in live pots · ${items.length} bounties listed</p>
      ${metaHtml(result)}
      <div class="toolbar" role="group" aria-label="Filter and sort">
        <input id="board-q" type="search" placeholder="Search title, category or skill…" value="${esc(boardState.query)}" aria-label="Search bounties">
        <button class="chip" data-filter="all" aria-pressed="${boardState.filter === 'all'}">All</button>
        <button class="chip" data-filter="open" aria-pressed="${boardState.filter === 'open'}">Open</button>
        <button class="chip" data-filter="closing" aria-pressed="${boardState.filter === 'closing'}">Closing soon</button>
        <button class="chip" data-filter="closed" aria-pressed="${boardState.filter === 'closed'}">Closed</button>
        <select id="board-sort" aria-label="Sort bounties">
          <option value="deadline" ${boardState.sort === 'deadline' ? 'selected' : ''}>Soonest deadline</option>
          <option value="pot" ${boardState.sort === 'pot' ? 'selected' : ''}>Biggest pot</option>
          <option value="entries" ${boardState.sort === 'entries' ? 'selected' : ''}>Most entries</option>
        </select>
      </div>
      ${list.length ? `<div class="grid">${list.map(bountyCard).join('')}</div>` : '<p class="empty">No bounties match that filter.</p>'}`;
    view.querySelector('#board-q').addEventListener('input', (e) => {
      boardState.query = e.target.value;
      paint();
      const q = view.querySelector('#board-q');
      q.focus();
      q.setSelectionRange(q.value.length, q.value.length);
    });
    view.querySelector('#board-sort').addEventListener('change', (e) => {
      boardState.sort = e.target.value;
      paint();
    });
    view.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        boardState.filter = btn.getAttribute('data-filter');
        paint();
      });
    });
  };
  paint();
  window.__shotReady = true;
}

// --------------------------------------------------------------- bounty ---

export async function renderBounty(view, slug) {
  view.innerHTML = `<h1>Bounty</h1>${loadingHtml('the bounty')}`;
  window.__shotReady = false;
  let result;
  try {
    result = await getBounty(slug);
  } catch (err) {
    view.innerHTML = `<h1>Bounty</h1>` + errorHtml(err);
    window.__shotReady = true;
    return;
  }
  const b = result.data;
  const open = isOpen(b.deadline);
  const state = open ? (isClosingSoon(b.deadline) ? 'closing' : 'open') : 'closed';
  const stateLabel = open ? (isClosingSoon(b.deadline) ? 'Closing soon' : 'Open for entries') : 'Entries closed';
  const fee = b.entryFeeUsd == null ? 'Free to enter' : `${money(b.entryFeeUsd)} entry fee`;
  const pot = b.potUsd != null ? money(b.potUsd) : money0(b.rewardAmount);
  const rewards = Array.isArray(b.rewardsNow) ? b.rewardsNow : [];
  const rewardsRows = rewards.length
    ? rewards.map((r) => `<tr><td>${esc(String(r.place))}${r.place === 1 ? 'st' : r.place === 2 ? 'nd' : r.place === 3 ? 'rd' : 'th'}</td><td class="num">${money(r.amountUsd)}</td><td class="num">${money(r.baseUsd)}</td><td class="num">${money(r.feeShareUsd)}</td></tr>`).join('')
    : Object.entries(b.rewards || {}).map(([place, amt]) => `<tr><td>${esc(place)}</td><td class="num">${money(amt)}</td><td class="num">—</td><td class="num">—</td></tr>`).join('');
  view.innerHTML = `<h1>${esc(b.title)}</h1>
    <p class="sub">${esc(b.category || '')}${b.sponsor ? ` · by ${esc(b.sponsor.name)}` : ''} · ${esc((b.skills || []).join(', '))}</p>
    ${metaHtml(result)}
    <div class="stats">
      <div class="stat"><b>${pot}</b><span>live pot</span></div>
      <div class="stat"><b>${esc(fee)}</b><span>entry fee</span></div>
      <div class="stat"><b>${Number(b.submissionCount || 0).toLocaleString('en-US')}</b><span>entries</span></div>
      <div class="stat"><b class="${state}" data-deadline="${esc(b.deadline)}">${esc(timeLeft(b.deadline))}</b><span>${esc(stateLabel)}</span></div>
    </div>
    <p><a class="btn" href="#/bounty/${esc(b.slug)}/leaderboard">View leaderboard</a>
    <a class="btn ghost" href="https://make.fun/bounty/${esc(b.slug)}">Open on make.fun →</a></p>
    <h2>Rewards</h2>
    <table><thead><tr><th>Place</th><th class="num">Pays now</th><th class="num">Base</th><th class="num">Fee share</th></tr></thead>
    <tbody>${rewardsRows || '<tr><td colspan="4">No rewards listed.</td></tr>'}</tbody></table>
    <h2>Dates</h2>
    <div class="facts">
      <span><span class="lbl">Opens</span> <b>${esc(dateTime(b.publishedAt || b.opens_at))}</b></span>
      <span><span class="lbl">Deadline</span> <b>${esc(dateTime(b.deadline))}</b></span>
    </div>
    <h2>About this bounty</h2>
    <div class="md">${renderMarkdown(b.description || '')}</div>`;
  window.__shotReady = true;
}

// ----------------------------------------------------------- leaderboard ---

function pageSlice(list, page) {
  const start = (page - 1) * PAGE_SIZE;
  return list.slice(start, start + PAGE_SIZE);
}

export async function renderLeaderboard(view, slug) {
  view.innerHTML = `<h1>Leaderboard</h1>${loadingHtml('the leaderboard')}`;
  window.__shotReady = false;
  let result;
  try {
    result = await getLeaderboard(slug);
  } catch (err) {
    view.innerHTML = `<h1>Leaderboard</h1>` + errorHtml(err);
    window.__shotReady = true;
    return;
  }
  const lb = result.data;
  const columns = lb.columns || [];
  const entries = lb.entries || [];
  const rankKey = lb.rank_key || (columns[0] ? columns[0].key : 'rank');
  let query = '';
  let page = 1;
  const paint = () => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? entries.filter((e) => `${e.handle || ''} ${e.title || ''}`.toLowerCase().includes(q))
      : entries;
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const rows = pageSlice(filtered, page);
    const head = `<tr><th class="num">#</th><th>Entrant</th><th>Entry</th>${columns.map((c) => `<th class="num">${esc(c.title)}</th>`).join('')}</tr>`;
    const body = rows.map((e) => {
      const rank = e.rank ?? e.prize_rank ?? '';
      const img = apiImageUrl(e.image);
      const avatar = img ? `<img crossorigin="anonymous" src="${esc(img)}" alt="" width="24" height="24" style="border-radius:50%;vertical-align:-6px;margin-right:6px">` : '';
      return `<tr>
        <td class="num"><b>${esc(String(rank))}</b></td>
        <td>${avatar}<a href="#/u/${esc(e.handle || '')}">${esc(e.handle || '—')}</a></td>
        <td>${esc(e.title || '—')}</td>
        ${columns.map((c) => `<td class="num">${esc((e.display && e.display[c.key]) ?? (e.values && e.values[c.key]) ?? '—')}</td>`).join('')}
      </tr>`;
    }).join('');
    view.innerHTML = `<h1>${esc(lb.competition ? lb.competition.title : slug)}</h1>
      <p class="sub">${esc(lb.title || 'Leaderboard')} · ranked by ${esc(rankKey)}${lb.phase ? ` · ${esc(lb.phase.title || '')}` : ''}</p>
      ${metaHtml(result, `${filtered.length.toLocaleString('en-US')} entries`)}
      <p><a class="btn ghost" href="#/bounty/${esc(slug)}">← Bounty page</a></p>
      <div class="toolbar">
        <input id="lb-q" type="search" placeholder="Search handle or entry…" value="${esc(query)}" aria-label="Search leaderboard">
      </div>
      ${filtered.length ? `<table><thead>${head}</thead><tbody>${body}</tbody></table>
      <div class="pager">
        <button class="btn ghost" id="lb-prev" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
        <span class="pageinfo">Page ${page} of ${pages} · ${PAGE_SIZE} per page</span>
        <button class="btn ghost" id="lb-next" ${page >= pages ? 'disabled' : ''}>Next →</button>
      </div>` : '<p class="empty">No entries yet — be the first.</p>'}`;
    const qEl = view.querySelector('#lb-q');
    qEl.addEventListener('input', (e) => { query = e.target.value; page = 1; paint(); const q2 = view.querySelector('#lb-q'); q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); });
    const prev = view.querySelector('#lb-prev');
    const next = view.querySelector('#lb-next');
    if (prev) prev.addEventListener('click', () => { page -= 1; paint(); });
    if (next) next.addEventListener('click', () => { page += 1; paint(); });
  };
  paint();
  window.__shotReady = true;
}

// --------------------------------------------------------------- profile ---

export async function renderProfile(view, handle) {
  view.innerHTML = `<h1>@${esc(handle)}</h1>${loadingHtml('the profile')}`;
  window.__shotReady = false;
  let result;
  try {
    result = await getProfile(handle);
  } catch (err) {
    view.innerHTML = `<h1>@${esc(handle)}</h1>` + errorHtml(err);
    window.__shotReady = true;
    return;
  }
  const p = result.data;
  const rec = p.record || {};
  const avatarUrl = p.avatar && p.avatar.url ? apiImageUrl(p.avatar.url) : null;
  const initials = (p.display_name || p.handle || '?').slice(0, 1).toUpperCase();
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${esc(p.github_login)}">GitHub</a>`);
  if (p.discord) links.push(`<span>Discord: ${esc(p.discord)}</span>`);
  if (p.x) links.push(`<a href="https://x.com/${esc(p.x)}">X</a>`);
  if (p.wallet) links.push(`<span>Wallet: <code>${esc(String(p.wallet).slice(0, 8))}…</code></span>`);
  const solutions = p.solutions || [];
  const rows = solutions.map((s) => {
    const c = s.competition || {};
    const score = s.score ? `${esc(s.score.display || '')} ${esc(s.score.column ? s.score.column.title : '')}` : '—';
    return `<tr>
      <td><a href="#/bounty/${esc(c.slug || '')}">${esc(c.title || c.slug || '—')}</a></td>
      <td class="num">${s.placement == null ? '—' : '#' + esc(String(s.placement))}</td>
      <td class="num">${s.prize_usd == null ? '—' : money(s.prize_usd)}</td>
      <td class="num">${score}</td>
      <td>${esc(dateShort(s.entered_at))}</td>
    </tr>`;
  }).join('');
  view.innerHTML = `<div class="profile-head">
      ${avatarUrl ? `<img class="avatar" crossorigin="anonymous" src="${esc(avatarUrl)}" alt="Avatar of ${esc(p.display_name || p.handle)}">` : `<span class="avatar avatar-fallback" aria-hidden="true">${esc(initials)}</span>`}
      <div>
        <h1>${esc(p.display_name || p.handle)}</h1>
        <p class="sub">@${esc(p.handle)} · joined ${esc(dateShort(p.joined_at))}</p>
      </div>
    </div>
    ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
    ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
    ${metaHtml(result)}
    <div class="stats">
      <div class="stat"><b>${Number(rec.competitions_entered || 0)}</b><span>entered</span></div>
      <div class="stat"><b>${Number(rec.competitions_won || 0)}</b><span>won</span></div>
      <div class="stat"><b>${Number(rec.competitions_placed || 0)}</b><span>placed</span></div>
      <div class="stat"><b>${rec.best_placement == null ? '—' : '#' + esc(String(rec.best_placement))}</b><span>best place</span></div>
      <div class="stat"><b>${money(rec.prize_usd || 0)}</b><span>prize money</span></div>
    </div>
    <h2>Entries (${solutions.length})</h2>
    ${solutions.length ? `<table><thead><tr><th>Bounty</th><th class="num">Place</th><th class="num">Prize</th><th class="num">Score</th><th>Entered</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="empty">No entries yet.</p>'}
    <p><a class="btn ghost" href="https://make.fun${esc(p.profile_url || '/u/' + p.handle)}">Open on make.fun →</a></p>`;
  window.__shotReady = true;
}

// -------------------------------------------------------------- rankings ---

export async function renderRankings(view) {
  view.innerHTML = `<h1>Top accounts</h1>${loadingHtml('the rankings')}`;
  window.__shotReady = false;
  let result;
  try {
    result = await getRankings();
  } catch (err) {
    view.innerHTML = `<h1>Top accounts</h1>` + errorHtml(err);
    window.__shotReady = true;
    return;
  }
  const items = (result.data.items || []).slice(0, 50);
  const rows = items.map((a) => {
    const r = a.record || {};
    const img = apiImageUrl(a.image);
    const avatar = img ? `<img crossorigin="anonymous" src="${esc(img)}" alt="" width="24" height="24" style="border-radius:50%;vertical-align:-6px;margin-right:6px">` : '';
    return `<tr>
      <td class="num"><b>${esc(String(a.rank))}</b></td>
      <td>${avatar}<a href="#/u/${esc(a.handle)}">${esc(a.display_name || a.handle)}</a></td>
      <td class="num">${Number(r.competitions_won || 0)}</td>
      <td class="num">${Number(r.competitions_placed || 0)}</td>
      <td class="num">${money(r.prize_usd || 0)}</td>
    </tr>`;
  }).join('');
  view.innerHTML = `<h1>Top accounts</h1>
    <p class="sub">Ranked by prize money won on make.fun.</p>
    ${metaHtml(result)}
    <table><thead><tr><th class="num">#</th><th>Account</th><th class="num">Won</th><th class="num">Placed</th><th class="num">Prize money</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  window.__shotReady = true;
}
