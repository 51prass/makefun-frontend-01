// Hash router for the four surfaces (plus top accounts), each with its own
// URL: #/ is the board, #/bounty/<slug> a bounty, #/bounty/<slug>/leaderboard
// its leaderboard, #/u/<handle> a public profile, #/rankings the top accounts.
// The header lookup jumps to a profile. A 30-second ticker refreshes the
// time-left labels in place, without rebuilding the page.

import { renderBoard, renderBounty, renderLeaderboard, renderProfile, renderRankings } from './views.js';
import { timeLeft } from './format.js';

const view = document.getElementById('view');

/** Route the current hash to its view. Unknown routes fall back to the board. */
function route() {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  window.__shotReady = false;
  window.scrollTo(0, 0);
  if (parts.length === 0) return renderBoard(view);
  if (parts[0] === 'rankings') return renderRankings(view);
  if (parts[0] === 'bounty' && parts[1] && parts.length === 2) return renderBounty(view, decodeURIComponent(parts[1]));
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') return renderLeaderboard(view, decodeURIComponent(parts[1]));
  if (parts[0] === 'u' && parts[1]) return renderProfile(view, decodeURIComponent(parts[1]));
  return renderBoard(view);
}

window.addEventListener('hashchange', route);

/** Profile lookup in the header: "@we-kolim" or "we-kolim" both work. */
document.getElementById('lookup').addEventListener('submit', (event) => {
  event.preventDefault();
  const q = document.getElementById('lookup-q').value.trim().replace(/^@/, '');
  if (q) location.hash = `#/u/${encodeURIComponent(q)}`;
});

/** Refresh only the time-left labels every 30 seconds; no re-render, no new requests. */
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    el.textContent = timeLeft(el.getAttribute('data-deadline'));
  });
}, 30000);

route();
