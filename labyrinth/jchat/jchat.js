// jchat live viewer for labyrinth/jchat/. Ported from the hub's view.html: the same presentation, polling and
// routes, with the hub on another origin. Every call is fetch(HUB + path) with a bearer token; no cookies.
const $ = id => document.getElementById(id);

// ---- the hub: every call goes to HUB. A link may name only this PC's loopback hub (http on 127.0.0.1 or localhost),
// so a link cannot send a password to another host; otherwise the saved hub, otherwise the default.
const DEFAULT_HUB = "http://127.0.0.1:8780";
const HUB_KEY = "jchat-hub";
const LOOPBACK = /^(127\.0\.0\.1|localhost)$/i;
function hubOf(raw) {  // the hub's origin, or "" when this page's policy refuses it
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return ""; }
  return u.protocol === "https:" || (u.protocol === "http:" && LOOPBACK.test(u.hostname)) ? u.origin : "";
}
function savedHub() { try { return localStorage.getItem(HUB_KEY) || ""; } catch { return ""; } }
const linkHub = hubOf(new URLSearchParams(location.search).get("hub") || "");
const linkRefused = new URLSearchParams(location.search).has("hub") && linkHub.indexOf("http:") !== 0;
let HUB = (linkHub.indexOf("http:") === 0 ? linkHub : "") || hubOf(savedHub()) || DEFAULT_HUB;

// ---- the session: one token per hub, in this tab's sessionStorage
const tokenKey = () => "jchat-token " + HUB;
const store = { get(k) { try { return sessionStorage.getItem(k) || ""; } catch { return ""; } },
                set(k, v) { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch {} } };
let token = store.get(tokenKey());

// PURE: presentation rules with no DOM or network of their own. The page runs them with `mk` (= el) for every row and bubble.
const WHEN = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });  // Nashville; "sv-SE" prints YYYY-MM-DD HH:MM:SS
function when(ts) { const d = new Date(ts || ""); return isNaN(d) ? (ts || "") : WHEN.format(d); }
function ago(ts) {
  const s = (Date.now() - Date.parse(ts || "")) / 1000;
  if (!(s >= 0)) return "";
  return s < 90 ? Math.round(s) + " s ago" : s < 5400 ? Math.round(s / 60) + " min ago" : s < 129600 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago";
}
const STATUSES = ["online", "active", "working", "starting", "review", "meeting", "blocked", "idle", "away", "dnd", "offline"];  // store.STATUSES plus the derived "online"
const TAGS = { greenflag: "GREENFLAG", done: "DONE", seal: "SEAL", redflag: "REDFLAG", pq: "PQ" };  // a message that opens with one of these words (or [word])
const TAG_RE = /^\s*\[?(greenflag|done|seal|redflag|pq)\]?(?![\w-])/i;
const MENTION = /@(hamm|all)(?![\w-])/;
const tagOf = text => { const m = TAG_RE.exec(text || ""); return m ? m[1].toLowerCase() : ""; };
const statusClass = s => STATUSES.includes(s) ? s : "unknown";
const statusLabel = s => s === "dnd" ? "do not disturb" : s || "unknown";
const HEADER_RE = /^\s*((?:status|tag)=[^\s]*|deliver|ask|claim)(?=\s|$)/i;  // a header word is chipped, never markup
const headWord = text => { const m = HEADER_RE.exec(text || ""); return m ? m[1] : ""; };
const GROUP_MS = 60000;  // consecutive messages from one sender within a minute (and one day) form one block
function dayOf(ts) { const d = new Date(ts || ""); return isNaN(d) ? "" : WHEN.format(d).slice(0, 10); }
const dayNum = s => s ? Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000 : NaN;
function dayLabel(ts, now) {  // "Today", "Yesterday" or the date itself
  const d = dayOf(ts), k = dayNum(dayOf(now)) - dayNum(d);
  return !d ? "" : k === 0 ? "Today" : k === 1 ? "Yesterday" : d;
}
function groupMsgs(msgs) {
  const out = [];
  for (const m of msgs || []) {
    const prev = out[out.length - 1], last = prev && prev.msgs[prev.msgs.length - 1];
    const t = Date.parse(m.ts || ""), t0 = last ? Date.parse(last.ts || "") : NaN;
    if (prev && prev.from === m.from && dayOf(m.ts) === dayOf(last.ts) && !isNaN(t) && !isNaN(t0) && t - t0 <= GROUP_MS) prev.msgs.push(m);
    else out.push({ from: m.from, msgs: [m] });
  }
  return out;
}
function hashOf(s) { let h = 5381; for (const c of String(s || "")) h = ((h * 33) ^ c.codePointAt(0)) >>> 0; return h; }
function initialsOf(name) {  // the avatar letters: a-b-x -> AB
  const parts = String(name || "?").split(/[-_\s]+/).filter(Boolean), first = (parts[0] || "?")[0] || "?";
  return (first + (parts.length > 1 ? (parts[1][0] || "") : ((parts[0] || "")[1] || ""))).toUpperCase();
}
const avatarClass = name => "h" + (hashOf(name) % 8);  // a stable colour from the name hash
const extraTags = p => (p && Array.isArray(p.tags) ? p.tags : []).filter(t => t && t !== p.name).map(String);  // tags beyond the id: an id-only tag list shows nothing
function tagChips(tags, mk) { return tags.map(t => mk("span", "tchip", t)); }  // text only: a tag is never markup
function rosterNode(p, status, seen, mk) {  // the note shows only while the status it belongs to is the one shown
  const b = mk("button", "it"), note = p.status && p.status === status && p.status_text ? ` · ${p.status_text}` : "";
  b.append(mk("span", "dot " + statusClass(status)), mk("span", "", `${p.name} · ${statusLabel(status)} · ${seen}${note}`), ...tagChips(extraTags(p), mk));
  return b;
}
function msgNode(m, stamp, mk, me) {  // one bubble: kind and tag chips above the text, time and a check (or via) under it
  const tg = tagOf(m.text), d = mk("div", "m" + (MENTION.test(m.text) ? " tag" : "") + (tg ? " t-" + tg : ""));
  const chips = [];
  if (m.kind && m.kind !== "msg") chips.push(mk("span", "k", m.kind + " "));
  if (tg) chips.push(mk("span", "t " + tg, TAGS[tg] + " "));
  const hw = headWord(m.text);
  if (hw) chips.push(mk("span", "w", hw));
  if (chips.length) { const c = mk("div", "chips"); chips.forEach(x => c.append(x)); d.append(c); }
  d.append(mk("div", "tx", m.text));
  const meta = mk("div", "meta"), own = m.from === "hamm" || (!!me && m.from === me);  // hamm is the account that posts
  meta.append(mk("span", "ts", `#${m.id} ${stamp}`));
  if (m.via) meta.append(mk("span", "via", "via " + m.via));  // a send-box post is marked, not a check
  else if (own) meta.append(mk("span", "ck", "✓"));
  d.append(meta);
  return d;
}
function chatRowNode(r, mk) {  // one chat-list row: avatar, name, one-line preview, time, unread count, presence dot
  const b = mk("button", "row" + (r.on ? " on" : ""));
  const av = mk("span", "av " + avatarClass(r.name), initialsOf(r.name));
  if (r.status) av.append(mk("span", "dot " + statusClass(r.status) + " pdot"));
  b.append(av);
  const mid = mk("span", "rowmain");
  const nm = mk("span", "rowname", r.name);
  tagChips(r.tags || [], mk).forEach(c => nm.append(c));
  mid.append(nm, mk("span", "rowprev", r.preview || ""));
  b.append(mid);
  const right = mk("span", "rowright");
  right.append(mk("span", "rowtime", r.time || ""));
  if (r.unread > 0) right.append(mk("span", "badge", String(r.unread)));
  b.append(right);
  return b;
}
function threadNodes(msgs, now, me, mk, freshFrom) {  // the conversation: day separators and one block per sender run
  const out = [], groups = groupMsgs(msgs);
  let day = "", idx = 0;
  for (const g of groups) {
    const start = idx; idx += g.msgs.length;
    const dk = dayOf(g.msgs[0].ts);
    if (dk && dk !== day) { day = dk; out.push(mk("div", "daysep", dayLabel(g.msgs[0].ts, now))); }
    const own = g.from === "hamm" || (!!me && g.from === me);
    const b = mk("div", "grp " + (own ? "out" : "in") + (freshFrom != null && idx > freshFrom ? " fresh" : ""));
    const h = mk("h3", "ghead");
    h.append(mk("span", "av " + avatarClass(g.from), initialsOf(g.from)), mk("span", "gname", g.from));
    b.append(h);
    for (const m of g.msgs) b.append(msgNode(m, when(m.ts), mk, me));
    out.push(b);
  }
  return out;
}
function unreadApply(unread, ev) {  // ev: {kind:"msg", room, open, n} counts lines in rooms the user is not in; {kind:"open", room} clears
  const u = Object.assign({}, unread);
  if (ev.kind === "open") u[ev.room] = 0;
  else if (ev.n > 0 && ev.room !== ev.open) u[ev.room] = (u[ev.room] || 0) + ev.n;
  return u;
}
// R-1: Hamm's own room controls. The hub checks every rule again; these only keep the page from offering what it refuses.
const PROTECTED_ROOMS = ["main", "conference", "redflags"];  // never deletable
const NEW_ROOM_RE = /^[pg]-[a-z0-9][a-z0-9_-]{0,37}$/;  // p-<project> or g-<guest>
const roomNameOk = name => NEW_ROOM_RE.test(String(name || ""));
const roomDeletable = name => !!name && !PROTECTED_ROOMS.includes(name) && !/^l-/.test(name);
const deleteConfirmOk = (typed, name) => roomDeletable(name) && typed === name;  // the typed name must be the room's, exactly
const liveCountOf = msg => { const m = /live count (\d+)/.exec(String(msg || "")); return m ? +m[1] : null; };  // the hub's no-archive refusal
function agendaNode(ch, mk) {  // owner, dates and sources as text only, with an expired badge; empty without an agenda
  const a = (ch && ch.agenda) || {}, parts = [];
  if (a.owner) parts.push("owner " + a.owner);
  if (a.opens) parts.push("opens " + a.opens);
  if (a.ends) parts.push("ends " + a.ends);
  if (a.sources && a.sources.length) parts.push("sources " + a.sources.join(", "));
  const d = mk("div", "agenda", parts.join(" • "));
  if (ch && ch.expired) d.append(mk("span", "bad expired", "expired"));
  return d;
}
function meetingNode(m, mk) {  // the open meeting: agenda and caller, then one row per member with a state chip (text only)
  const d = mk("div", "meeting");
  d.append(mk("div", "mhead", `meeting #${m.id} • ${m.agenda} • called by ${m.called_by}`));
  for (const r of m.table || []) {
    const row = mk("div", "mrow");
    row.append(mk("span", "mchip " + (["called", "joining", "present", "absent", "left"].includes(r.state) ? r.state : "called"), r.state), mk("span", "", r.member));
    d.append(row);
  }
  return d;
}
// END PURE

const POLL_MS = 8000;     // the open room; plain polls while the tab is visible, nothing while it is hidden
const SWEEP_MS = 60000;   // every other room, the claims and the roster, for the graph
const ONLINE_MS = 15 * 60000;
const KEEPER_MODEL = "prism-ml/Ternary-Bonsai-2-27B-gguf";
let room = "main", gen = 0, epoch = 0, timer = 0, sweepTimer = 0, shown = 0, mode = "log", sel = "";  // epoch: one per sign-in
const S = { roster: [], rooms: [], feeds: {}, claims: {}, chan: {} };  // feeds: room -> {last, msgs}; claims: room -> board; chan: room -> its channel
let canPost = false;  // a viewer whose account has can_post sends through the box under the room
let canRooms = false;  // R-1: an account Hamm flagged can_rooms gets the new-room and delete-room controls
let delCount = null;  // the live message count of a room the hub could not archive: the second press sends it
let meName = "", unread = {}, newCount = 0, rendered = false;  // unread: room -> lines missed while it was not open
const live = () => !!token;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

async function api(path, body) {  // every call goes to HUB with the bearer token; no cookies, no credentials mode
  const r = await fetch(HUB + path, { method: body ? "POST" : "GET", credentials: "omit", body: body && JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(token ? { "Authorization": "Bearer " + token } : {}) } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && live()) { signOut("Session ended. Sign in again."); throw new Error("signed out"); }
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}
const reach = err => err instanceof TypeError ? "the hub did not answer this page (is it running, and does it allow this origin?)" : err.message;

function signOut(msg) {
  store.set(tokenKey(), ""); token = ""; gen++; epoch++; clearTimeout(timer); clearTimeout(sweepTimer);
  S.roster = []; S.rooms = []; S.feeds = {}; S.claims = {}; S.chan = {}; sel = ""; unread = {}; newCount = 0; canRooms = false; roomTools(); build();
  $("app").hidden = true; $("login").hidden = false; $("err").textContent = msg || "";
}

// Changing the hub clears the token: a session belongs to the hub that issued it.
function setHub(next) {
  if (next === HUB) return;
  store.set(tokenKey(), ""); token = "";
  HUB = next;
  try { localStorage.setItem(HUB_KEY, HUB); } catch {}
  $("hub").value = HUB; $("hubtop").value = HUB;
  if (!$("app").hidden) signOut("hub changed: sign in again");
}
function hubField(input) {  // a typed hub is checked before any call goes to it
  const h = hubOf(input.value);
  if (!h) { input.value = HUB; $("err").textContent = "hub: use an https address, or http on 127.0.0.1 or localhost"; return false; }
  $("err").textContent = "";
  setHub(h);
  return true;
}
$("hub").addEventListener("change", () => hubField($("hub")));
$("hubtop").addEventListener("change", () => hubField($("hubtop")));

$("login").onsubmit = async e => {
  e.preventDefault();
  if (!hubField($("hub"))) return;
  $("err").textContent = "";
  try {
    const r = await api("/login", { username: $("user").value.trim(), password: $("pass").value });
    token = r.token; store.set(tokenKey(), token);
    $("pass").value = "";
    start(r.username, r.expires_at, r.can_post, r.can_rooms);
  } catch (err) { $("err").textContent = reach(err); }
};
$("out").onclick = () => signOut();
$("sendbox").onsubmit = async e => {
  e.preventDefault();
  $("senderr").textContent = "";
  const text = $("sendtext").value;
  if (!text.trim()) return;
  try {
    const n = room;
    const cid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
      "web-" + Date.now() + "-" + Math.floor(Math.random() * 1e9);
    await api("/send", { room: n, text, client_msg_id: cid });
    $("sendtext").value = "";
    $("sendtext").style.height = "";
    $("sendbtn").disabled = true;
    await pull(n);
    if (n === room) renderLog();
  } catch (err) { $("senderr").textContent = err.message; }
};
// the composer: the textarea grows to five lines, Enter sends, Shift+Enter breaks the line
function grow(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 5 * 22) + "px"; }
$("sendtext").addEventListener("input", () => { grow($("sendtext")); $("sendbtn").disabled = !$("sendtext").value.trim(); });
$("sendtext").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("sendbox").requestSubmit(); }
});
$("newpill").onclick = () => { newCount = 0; $("newpill").hidden = true; $("log").scrollTop = $("log").scrollHeight; };
const pane = p => { document.body.dataset.pane = p; };
$("back").onclick = () => pane("list");
$("sideToggle").onclick = () => {
  if (matchMedia("(max-width: 759px)").matches) pane("side");
  else $("app").classList.toggle("side-min");
};

async function me() {  // the send box follows the session's flag, which lives on the hub
  try { const r = await api("/me"); canPost = !!r.can_post; canRooms = !!r.can_rooms; } catch { canPost = false; canRooms = false; }
  box(); pill();
}

function roomTools() {  // the new-room form shows for a can_rooms session; Delete only for a room that may be deleted
  $("newroom").hidden = !canRooms;
  $("delroom").hidden = !(canRooms && roomDeletable(room));
  if ($("delroom").hidden) $("delbox").hidden = true;
}
$("newroom").onsubmit = async e => {
  e.preventDefault();
  const n = $("nrname").value.trim(), p = $("nrpurpose").value.trim(), err = $("nrerr");
  err.textContent = "";
  if (!roomNameOk(n)) { err.textContent = "a name is p-<project> or g-<guest>: lowercase letters, digits, - and _"; return; }
  if (!p) { err.textContent = "give the room a one-line purpose"; return; }
  try {
    await api("/admin/room", { room: n, purpose: p });
    $("nrname").value = ""; $("nrpurpose").value = "";
    pick(n);  // pick refreshes the room list, which now holds it
  } catch (x) { err.textContent = x.message; }
};
$("delroom").onclick = () => {
  delCount = null; $("delerr").textContent = ""; $("delname").value = "";
  $("delprompt").textContent = `Type ${room} to delete it with all its messages.`;
  $("delbox").hidden = false; $("delname").focus();
};
$("delcancel").onclick = () => { delCount = null; $("delbox").hidden = true; };
$("delbox").onsubmit = async e => {
  e.preventDefault();
  const n = room, typed = $("delname").value, err = $("delerr");
  err.textContent = "";
  if (!deleteConfirmOk(typed, n)) { err.textContent = "the typed name is not this room's name"; return; }
  try {
    await api("/admin/room/delete", { room: n, confirm: typed, ...(delCount != null ? { messages: delCount } : {}) });
    delCount = null; $("delbox").hidden = true;
    delete S.feeds[n]; delete S.claims[n]; delete S.chan[n];
    pick("main");  // the room is gone: back to main, whose refresh drops it from the list
  } catch (x) {
    const k = liveCountOf(x.message);
    if (k != null && delCount == null) { delCount = k; err.textContent = `This hub has no archive: its ${k} messages would be lost for good. Press Delete again to confirm.`; }
    else err.textContent = x.message;
  }
};

function box() {  // the send box, only for a session that may post
  $("sendbox").hidden = !canPost;
  $("foot").textContent = canPost ? "jchat hub • send box: posts as hamm in main, conference, redflags • times in Nashville (Central)"
    : "jchat hub • read-only viewer • times in Nashville (Central)";
  roomTools();
}

function start(name, exp, post, roomsFlag) {
  $("login").hidden = true; $("app").hidden = false;
  $("me").textContent = name || "signed in";
  meName = name || meName;
  canPost = !!post; canRooms = !!roomsFlag;
  setMode("log");  // the conversation is what the page is for; the Graph tab is one click away
  box();
  pill();
  if (exp) $("status").textContent = "session until " + when(exp);
  epoch++;  // before the first read, or its answer would be dropped as stale
  pick("main");
  clearTimeout(sweepTimer); sweep(epoch);
  if (live()) me();  // the flag lives on the hub, not in storage
}

// ---- data: one feed per room; the log shows the open room, the graph reads them all
async function pull(n) {
  const f = S.feeds[n] || (S.feeds[n] = { last: 0, msgs: [] });
  if (f.busy) return f.busy;
  const e = epoch;
  f.busy = (async () => {
    const r = await api(`/read?room=${encodeURIComponent(n)}&since=${f.last}`);
    if (e !== epoch) return 0;  // signed out meanwhile: this answer belongs to nobody
    f.loaded = true;
    f.msgs.push(...r.messages);
    if (f.msgs.length > 600) { const cut = f.msgs.length - 600; f.msgs.splice(0, cut); if (n === room) shown = Math.max(0, shown - cut); }
    f.last = r.last || f.last;
    return r.messages.length;
  })();
  try { return await f.busy; } finally { f.busy = null; }
}

function skeletons() {  // three placeholder rows while the first read is in flight
  return [0, 1, 2].map(() => { const d = el("div", "skel"); d.append(el("span", "skel-av"), el("span", "skel-line"), el("span", "skel-line short")); return d; });
}
function renderLog() {
  const f = S.feeds[room], log = $("log");
  if (!f || !f.loaded) { shown = 0; rendered = false; log.replaceChildren(...skeletons()); return; }
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30, top = log.scrollTop;
  const freshFrom = shown;
  shown = f.msgs.length;
  log.replaceChildren(...threadNodes(f.msgs, Date.now(), meName, el, rendered ? freshFrom : -1));
  if (!rendered) { log.scrollTop = log.scrollHeight; newCount = 0; rendered = true; }
  else if (stick) { log.scrollTop = log.scrollHeight; newCount = 0; }  // pinned to the bottom only when it was at the bottom
  else { log.scrollTop = top; if (shown > freshFrom) newCount += shown - freshFrom; }
  $("newpill").hidden = !newCount;
  $("newpill").textContent = newCount + " new";
}

function failBanner(step, e) {  // names the step that threw and why; no URL, query or token, under 80 characters
  const why = String(e && e.message != null ? e.message : e || "").replace(/https?:\S*|\S*\?\S*|Bearer\s+\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
  return `hub not answering (${step.slice(0, 24)}${why ? ": " + why : ""}); retrying`;
}
async function tick(g) {
  if (g !== gen || !live()) return;
  if (!document.hidden) {
    let step = "read " + room;  // each step sets its label before it awaits, so the banner names the one that threw
    try {
      const first = !(S.feeds[room] && S.feeds[room].loaded), n = await pull(room);
      if (g !== gen) return;
      step = "render";
      renderLog();
      step = "meetings";
      await meetingPull(g);  // the open meeting rides the same poll: one extra read per tick, in meeting rooms only
      if (n || first) folds();
      $("net").textContent = "";
    } catch (e) { if (g !== gen) return; $("net").textContent = failBanner(step, e); }
  }
  timer = setTimeout(() => tick(g), POLL_MS);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && live()) { clearTimeout(timer); tick(++gen); kick(); } });  // ++gen ends a tick still in flight

async function folds() {
  try {
    const n = room, c = await api(`/claims?room=${encodeURIComponent(n)}`);
    S.claims[n] = c.claims;
    const a = await api(`/asks?room=${encodeURIComponent(n)}`);
    if (n !== room) return;
    $("claims").replaceChildren(...c.claims.map(x => el("div", "it", `${x.item} · ${x.by}${x.contested ? " · contested" : ""}${x.stale ? " · stale" : ""}`)));
    $("asks").replaceChildren(...a.asks.map(x => el("div", "it", `#${x.id} ${x.from}: ${x.text}`)));
    await roster();
  } catch {}
}

function pill() {  // the header's status line, in the jynx site's manner
  const on = S.roster.filter(p => statusOf(p) !== "offline"), kp = S.roster.some(p => /^keeper(-|$)/.test(p.name));
  const part = (t, cls) => [el("span", "sep", "|"), el("span", cls, t)];
  $("pill").replaceChildren(el("i"), el("span", "", "source: hub"),
    ...part(`${on.length} of ${S.roster.length} online`), ...part(`${on.filter(p => statusOf(p) === "working").length} working`),
    ...part(kp ? "keeper: on" : "keeper: not running", kp ? "" : "warn"), ...part(canPost ? "send box" : "read-only", canPost ? "" : "warn"));
}

const oneLine = t => String(t || "").replace(/\s+/g, " ").trim();
function previewOf(n) {  // the chat list's one-line preview and clock time from the room's last message
  const f = S.feeds[n], m = f && f.msgs.length ? f.msgs[f.msgs.length - 1] : null;
  return m ? { text: oneLine(m.text), time: when(m.ts).slice(11, 16) } : { text: "", time: "" };
}
function chatList() {  // the left zone: rooms and the roster as rows
  $("rooms").replaceChildren(...S.rooms.map(n => {
    const pv = previewOf(n);
    const r = chatRowNode({ name: n, preview: pv.text.slice(0, 80), time: pv.time, unread: unread[n] || 0, on: n === room }, el);
    r.type = "button"; r.onclick = () => pick(n);
    return r;
  }));
  $("agents").replaceChildren(...S.roster.map(p => {
    const lb = lastBy(p.name);
    const r = chatRowNode({ name: p.name, preview: oneLine(lb ? lb.m.text : p.status_text || statusLabel(statusOf(p))).slice(0, 80),
      time: ago(p.last_seen) || "never", status: statusOf(p), tags: extraTags(p), on: sel === "a:" + p.name }, el);
    r.type = "button"; r.onclick = () => { select("a:" + p.name); pane("side"); };
    return r;
  }));
}

async function roster() {
  S.roster = (await api("/roster")).roster;
  S.roster.sort((x, y) => (y.last_seen || "").localeCompare(x.last_seen || ""));
  $("roster").replaceChildren(...S.roster.map(p => {
    const b = rosterNode(p, statusOf(p), ago(p.last_seen) || "never", el); b.type = "button";
    b.onclick = () => select("a:" + p.name);
    return b;
  }));
  pill(); build(); chatList();
}

async function rooms() {
  let names = ["main", "conference"], chans = [];
  try { const r = await api("/rooms"); names = [...new Set([...names, ...r.rooms])]; chans = r.channels || []; } catch {}
  S.rooms = names;
  S.chan = {}; for (const c of chans) S.chan[c.name] = c;
  chatList();
  renderAgenda();
}

async function sweep(e) {
  if (e !== epoch || !live()) return;
  if (!document.hidden) {
    try {
      await rooms();
      for (const n of S.rooms) {
        if (n === room || e !== epoch) continue;
        try {
          const k = await pull(n);
          unread = unreadApply(unread, { kind: "msg", room: n, open: room, n: k });  // lines in rooms the user is not in
          if (n === "main" || n.startsWith("p-")) S.claims[n] = (await api(`/claims?room=${encodeURIComponent(n)}`)).claims;
        } catch {}
      }
      await roster();
    } catch {}
  }
  if (e === epoch && live()) sweepTimer = setTimeout(() => sweep(e), SWEEP_MS);
}

function pick(n) {
  room = n; shown = 0; gen++; clearTimeout(timer); rendered = false; newCount = 0;
  unread = unreadApply(unread, { kind: "open", room: n });  // opening a room clears its count
  $("log").replaceChildren(); $("claims").replaceChildren(); $("asks").replaceChildren();
  $("newpill").hidden = true; $("ctitle").textContent = n;
  $("sendtext").placeholder = `in ${n} · write as hamm`;  // the composer writes to the chat that is open: no room list
  renderAgenda(); renderLog(); rooms(); chatList(); tick(gen); pane("chat");
  delCount = null; $("delbox").hidden = true; roomTools();  // a half-typed delete never follows you to another room
}

async function meetingPull(g) {  // meetings exist only in conference and p- rooms; a failed read just hides the table
  const m = $("meeting"), n = room;
  if (n !== "conference" && !n.startsWith("p-")) { m.hidden = true; m.replaceChildren(); return; }
  let mt = null;
  try { mt = (await api(`/meetings?room=${encodeURIComponent(n)}`)).meeting; } catch {}
  if (g !== gen || n !== room) return;
  m.hidden = !mt;
  m.replaceChildren(...(mt ? [meetingNode(mt, el)] : []));
}

function renderAgenda() {  // the open room's agenda as plain text above the log, badge when its end date has passed
  const ch = S.chan[room], a = $("agenda");
  a.replaceChildren();
  a.hidden = !(ch && ch.agenda);
  if (!a.hidden) a.append(agendaNode(ch, el));
}

function setMode(m) {
  mode = m; $("log").hidden = m !== "log";
  $("tg").className = m === "graph" ? "on" : ""; $("tl").className = m === "log" ? "on" : "";
  if (m === "log") $("log").scrollTop = $("log").scrollHeight;
  box();
  kick();
}
$("tg").onclick = () => setMode("graph");
$("tl").onclick = () => setMode("log");

// ---- what the graph shows about an agent
const projectOf = p => p.project || p.name.split("-")[0];
function claimsOf(name) {
  const out = [];
  for (const [r, board] of Object.entries(S.claims)) for (const c of board) if (c.by === name && !c.stale) out.push({ room: r, item: c.item });
  return out;
}
const STATUS_FRESH_MS = 12 * 3600 * 1000;  // a status the agent set itself counts for 12 hours
function statusOf(p) {
  const on = Date.now() - Date.parse(p.last_seen || "") < ONLINE_MS;
  if (p.status && Date.now() - Date.parse(p.status_at || "") < STATUS_FRESH_MS) return p.status;
  return on && claimsOf(p.name).length ? "working" : on ? "online" : "offline";
}
function lastBy(name) {
  let best = null;
  for (const [r, f] of Object.entries(S.feeds)) for (let i = f.msgs.length - 1; i >= 0; i--) {
    const m = f.msgs[i];
    if (m.from === name) { if (!best || m.ts > best.m.ts) best = { m, room: r }; break; }
  }
  return best;
}

function select(id) { sel = id; card(); chatList(); kick(); }
function card() {
  const c = $("card"), n = nodes.get(sel);
  if (!n) { c.hidden = true; return; }
  const x = el("button", "x", "×"); x.type = "button"; x.title = "Close"; x.onclick = () => select("");
  c.hidden = false;
  const head = el("div", "t", n.title || n.label);
  if (n.type === "agent") tagChips(extraTags(n.p), el).forEach(k => head.append(k));  // the member's tags beside its id
  c.replaceChildren(x, head);
  const line = (t, cls) => c.append(el("div", cls || "mute", t));
  if (n.type === "agent") {
    const p = n.p, cl = claimsOf(p.name), lb = lastBy(p.name);
    line(`${n.status} · project ${projectOf(p)} · seen ${when(p.last_seen)} (${ago(p.last_seen) || "never"})`);
    if (cl.length) line("claims: " + cl.map(k => `${k.item} (${k.room})`).join(", "), "ok");
    if (lb) { line(`latest: #${lb.m.id} in ${lb.room}, ${ago(lb.m.ts)}${lb.m.kind && lb.m.kind !== "msg" ? " · " + lb.m.kind : ""}`); line(lb.m.text.slice(0, 600), "b"); }
    else line("no message in the rooms loaded here");
  } else if (n.type === "project") {
    const ps = S.roster.filter(p => projectOf(p) === n.label);
    line(n.room ? `room ${n.room}` : "no project room yet");
    ps.forEach(p => line(`${p.name} · ${statusOf(p)} · ${ago(p.last_seen) || "never"}`, "it"));
    (S.claims[n.room] || []).forEach(k => line(`claim ${k.item} · ${k.by}${k.stale ? " · stale" : ""}`, "it"));
  } else if (n.type === "keeper") {
    line(n.p ? `${n.status} · seen ${when(n.p.last_seen)} (${ago(n.p.last_seen)})` : "not running: no keeper profile on the hub yet");
    line("model: " + KEEPER_MODEL);
    line("propose-only: it suggests the next action and never pushes, merges or deletes");
  } else {
    const on = S.roster.filter(p => statusOf(p) !== "offline").length;
    line(`${S.roster.length} agents, ${on} online · ${S.rooms.length} rooms`);
  }
}

// ---- the sky: agents float around their projects, projects around the hub
const cv = $("sky"), cx = cv.getContext("2d"), nodes = new Map();
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const AMBER = [255, 190, 96], GOLD = [255, 236, 190], BLUE = [120, 210, 255], DIM = [122, 108, 170], RED = [248, 113, 113], VIO = [216, 180, 254];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
let W = 0, H = 0, raf = 0, hover = "", seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const stars = Array.from({ length: 170 }, () => ({ x: rnd(), y: rnd(), r: .4 + rnd() * 1.1, ph: rnd() * 6.3, c: rnd() < .22 ? BLUE : rnd() < .5 ? [190, 150, 255] : GOLD }));
const clouds = [[.16, .20, .46, [134, 109, 75], .30], [.82, .26, .42, [90, 74, 50], .30], [.56, .84, .50, [134, 109, 75], .22], [.30, .72, .34, [70, 58, 40], .30],
  [.94, .86, .34, [110, 90, 60], .20], [.50, .46, .30, [207, 184, 124], .08]];  // the site's gold on black

function resize() {
  const d = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
  build();
}

function build() {
  const st = $("app").hidden ? { left: 0, top: 0, width: W, height: H } : $("stage").getBoundingClientRect();
  const mx = st.left + st.width / 2, my = st.top + st.height / 2;
  const rx = Math.max(70, Math.min(st.width * .33, st.width / 2 - 90)), ry = Math.max(100, st.height * .31);
  const want = new Map();
  if (S.roster.length || S.rooms.length) {
    const kp = S.roster.find(p => /^keeper(-|$)/.test(p.name)), agents = S.roster.filter(p => p !== kp);
    want.set("hub", { type: "hub", label: "main", title: "jchat hub · main", tx: mx, ty: my, r: 15, status: "hub", room: "main" });
    want.set("keeper", { type: "keeper", label: "keeper", title: "Keeper", tx: mx + rx * .34, ty: my - ry * .42, r: 10, status: kp ? statusOf(kp) : "offline", p: kp, parent: "hub" });
    const projects = [...new Set([...S.rooms.filter(n => n.startsWith("p-")).map(n => n.slice(2)), ...agents.map(projectOf)])].sort();
    projects.forEach((name, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / projects.length, mine = agents.filter(p => projectOf(p) === name);
      const px = mx + Math.cos(a) * rx, py = my + Math.sin(a) * ry;
      const lit = mine.some(p => statusOf(p) !== "offline");
      want.set("p:" + name, { type: "project", label: name, tx: px, ty: py, r: 11, status: lit ? "online" : "offline", parent: "hub", room: S.rooms.includes("p-" + name) ? "p-" + name : "" });
      mine.sort((x, y) => x.name.localeCompare(y.name)).forEach((p, j) => {
        const b = a + (j - (mine.length - 1) / 2) * .78, d = 74 + (j % 2) * 16;
        want.set("a:" + p.name, { type: "agent", label: p.name, tx: px + Math.cos(b) * d, ty: py + Math.sin(b) * d, r: 6.5, status: statusOf(p), p, parent: "p:" + name });
      });
    });
  }
  for (const id of [...nodes.keys()]) if (!want.has(id)) nodes.delete(id);
  for (const [id, w] of want) {
    const old = nodes.get(id), from = nodes.get(w.parent) || { x: mx, y: my };
    nodes.set(id, Object.assign(old || { x: from.x, y: from.y, ph: rnd() * 6.3 }, w, { id }));
  }
  if (!nodes.has(sel)) sel = "";
  card(); kick();
}

function curve(a, b, k, t) {  // a quadratic filament from a to b, bowed sideways by k
  const dx = b.px - a.px, dy = b.py - a.py, len = Math.hypot(dx, dy) || 1;
  return { cx: (a.px + b.px) / 2 - dy / len * k, cy: (a.py + b.py) / 2 + dx / len * k };
}
function glow(x, y, r, c, a) {
  const g = cx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(c, a)); g.addColorStop(.3, rgba(c, a * .4)); g.addColorStop(1, rgba(c, 0));
  cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 6.3); cx.fill();
}
const tint = n => n.type === "hub" || n.type === "keeper" ? (n.type === "keeper" && n.status === "offline" ? DIM : BLUE) : n.status === "blocked" ? RED : n.status === "review" ? VIO : ["working", "starting"].includes(n.status) ? GOLD : ["online", "active"].includes(n.status) ? AMBER : DIM;

function draw(t) {
  cx.globalCompositeOperation = "source-over";
  cx.fillStyle = "#000000"; cx.fillRect(0, 0, W, H);
  clouds.forEach(([x, y, r, c, a], i) => {  // the nebula drifts a little
    const px = (x + Math.sin(t * .03 + i) * .02) * W, py = (y + Math.cos(t * .025 + i * 2) * .02) * H;
    const g = cx.createRadialGradient(px, py, 0, px, py, r * Math.max(W, H));
    g.addColorStop(0, rgba(c, a * .8)); g.addColorStop(.5, rgba(c, a * .28)); g.addColorStop(1, rgba(c, 0));
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  });
  for (const s of stars) { cx.fillStyle = rgba(s.c, .35 + .35 * Math.sin(t * .8 + s.ph)); cx.beginPath(); cx.arc(s.x * W, s.y * H, s.r, 0, 6.3); cx.fill(); }
  const fade = mode === "log" ? .35 : 1;
  for (const n of nodes.values()) {
    n.x += (n.tx - n.x) * (still ? 1 : .06); n.y += (n.ty - n.y) * (still ? 1 : .06);
    const f = n.type === "hub" ? 3 : n.type === "project" ? 6 : 9;
    n.px = n.x + Math.sin(t * .45 + n.ph) * f; n.py = n.y + Math.cos(t * .37 + n.ph * 1.7) * f;
  }
  cx.globalCompositeOperation = "lighter";
  for (const n of nodes.values()) {
    const p = nodes.get(n.parent);
    if (!p) continue;
    const c = tint(n), on = n.status !== "offline", hot = n.id === sel || n.id === hover || p.id === sel;
    for (let s = -3; s <= 3; s++) {  // a bundle of strands that breathes
      const q = curve(p, n, 16 + s * 11 + Math.sin(t * .5 + n.ph + s * 1.3) * 7, t);
      cx.strokeStyle = rgba(s % 2 ? c : (on ? GOLD : c), (on ? .30 : .12) * fade * (hot ? 1.8 : 1) / (1 + Math.abs(s) * .25)); cx.lineWidth = s ? .7 : 1.3;
      cx.beginPath(); cx.moveTo(p.px, p.py); cx.quadraticCurveTo(q.cx, q.cy, n.px, n.py); cx.stroke();
      if (s && on) { const u = .3 + .4 * ((s + 3) / 6), v = 1 - u;  // a bead on the strand
        glow(v * v * p.px + 2 * v * u * q.cx + u * u * n.px, v * v * p.py + 2 * v * u * q.cy + u * u * n.py, 4, c, .7 * fade); }
    }
    const k = n.status === "working" ? 3 : on ? 1 : 0, q = curve(p, n, 14, t);
    for (let i = 0; i < k; i++) {  // light running along the filament: faster for a working agent
      const u = ((t * (n.status === "working" ? .32 : .12) + i / k + n.ph) % 1 + 1) % 1, v = 1 - u;
      glow(v * v * n.px + 2 * v * u * q.cx + u * u * p.px, v * v * n.py + 2 * v * u * q.cy + u * u * p.py, 5, GOLD, .9 * fade);
    }
  }
  const ring = [...nodes.values()].filter(n => n.type === "project");
  ring.forEach((a, i) => {  // faint threads between neighbouring projects close the web
    const b = ring[(i + 1) % ring.length];
    if (ring.length < 3 || !b) return;
    for (let s = 0; s < 2; s++) {
      const q = curve(a, b, -34 - s * 16 + Math.sin(t * .4 + a.ph + s) * 8, t);
      cx.strokeStyle = rgba(a.status === "offline" && b.status === "offline" ? DIM : AMBER, .12 * fade); cx.lineWidth = .7;
      cx.beginPath(); cx.moveTo(a.px, a.py); cx.quadraticCurveTo(q.cx, q.cy, b.px, b.py); cx.stroke();
    }
  });
  for (const n of nodes.values()) {
    const c = tint(n), on = n.status !== "offline", hot = n.id === sel || n.id === hover;
    const r = n.r * (n.status === "working" ? 1 + .14 * Math.sin(t * 3 + n.ph) : 1) * (hot ? 1.25 : 1);
    glow(n.px, n.py, r * (on ? 6 : 3.4), c, (on ? .9 : .45) * fade);
    cx.strokeStyle = rgba(c, (on ? .95 : .55) * fade); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(n.px, n.py, r, 0, 6.3); cx.stroke();
    cx.fillStyle = rgba(on ? [255, 250, 235] : c, (on ? .95 : .5) * fade); cx.beginPath(); cx.arc(n.px, n.py, r * .5, 0, 6.3); cx.fill();
  }
  cx.globalCompositeOperation = "source-over";
  cx.textAlign = "center";
  for (const n of nodes.values()) {
    const on = n.status !== "offline", hot = n.id === sel || n.id === hover, big = n.type === "project" || n.type === "hub";
    cx.font = (big ? "600 13px" : "11px") + " system-ui, sans-serif";
    cx.fillStyle = rgba([237, 237, 237], (on || hot ? .95 : .55) * fade);
    cx.fillText(n.label, n.px, n.py + n.r + 15);
    const sub = n.type === "agent" ? (n.status === "working" ? "working · " + claimsOf(n.label).map(k => k.item).join(", ") : hot ? n.status : "")
      : n.type === "keeper" ? (n.p ? n.status : "not running") : "";
    if (sub) { cx.font = "10px ui-monospace, Consolas, monospace"; cx.fillStyle = rgba(n.status === "working" ? [251, 191, 36] : [163, 163, 163], .9 * fade); cx.fillText(sub.slice(0, 40), n.px, n.py + n.r + 28); }
  }
}

function frame(ms) { raf = 0; draw(still ? 0 : ms / 1000); if (!still && !document.hidden) raf = requestAnimationFrame(frame); }
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
function at(e) {
  let best = "", bd = 1e9;
  for (const n of nodes.values()) { const d = Math.hypot(e.clientX - n.px, e.clientY - n.py) - n.r; if (d < 12 && d < bd) { bd = d; best = n.id; } }
  return best;
}
cv.addEventListener("mousemove", e => { const h = mode === "graph" ? at(e) : ""; if (h !== hover) { hover = h; cv.style.cursor = h ? "pointer" : ""; kick(); } });
cv.addEventListener("click", e => {
  if (mode !== "graph") return;
  const id = at(e), n = nodes.get(id);
  select(id);
  if (n && n.room && n.room !== room) pick(n.room);
});
window.addEventListener("resize", resize);
window.addEventListener("scroll", build, { passive: true });  // a stacked layout scrolls; the canvas does not
resize();

// ---- start: the hub fields show the hub in use; a remembered token resumes the session, otherwise the sign-in form waits
$("hub").value = HUB; $("hubtop").value = HUB;
if (linkRefused) $("err").textContent = "the link's hub was refused: a link may name only this PC's loopback hub";
if (token) start("", "");
