// DayLedger — Scriptable home-screen widget (iOS)
// Shows today's timetable from your DayLedger cloud data.
//
// SETUP (one time, done inside the Scriptable app on your iPhone):
//   1. Fill in CFG.uid and CFG.password below.
//   2. Tap ▶ to test — you should see a preview of today's plan.
//   3. Add a Scriptable widget to the home screen and pick this script.
// The email/password here belong to a READ-ONLY reader account, not your
// Google account. Firestore rules only let it read, never write.

const CFG = {
  uid: "PASTE_YOUR_ACCOUNT_UID_HERE",   // Firebase → Authentication → Users → your Google row → "User UID"
  email: "widget@dayledger.app",        // the reader account created in Firebase
  password: "PASTE_WIDGET_PASSWORD_HERE",
  apiKey: "AIzaSyBI3NU344WC1lgxNkjXyRWO1eauNncVmLE",  // Firebase web config (public, not a secret)
  projectId: "timetable-df244",
  appUrl: "https://lim0070.github.io/app/timetable/timetable.html",
  show: "plan"                          // "plan" or "actual"
};

const INK = "#16233B", TXT = "#EAF0F8", SOFT = "#8DA0BF", HL = "#FFD54D";

const pad = n => String(n).padStart(2, "0");
const fmt = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function textColorFor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#16233B" : "#FFFFFF";
}

async function signIn() {
  const req = new Request("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + CFG.apiKey);
  req.method = "POST";
  req.headers = { "Content-Type": "application/json" };
  req.body = JSON.stringify({ email: CFG.email, password: CFG.password, returnSecureToken: true });
  const res = await req.loadJSON();
  if (!res.idToken) throw new Error("sign-in failed: " + ((res.error && res.error.message) || "unknown"));
  return res.idToken;
}
async function fsGetJ(token, path) {
  const req = new Request("https://firestore.googleapis.com/v1/projects/" + CFG.projectId +
    "/databases/(default)/documents/" + path);
  req.headers = { "Authorization": "Bearer " + token };
  const res = await req.loadJSON();
  if (res.error) {
    if (res.error.code === 404) return null;          // doc doesn't exist (e.g. empty day)
    throw new Error("firestore: " + res.error.message);
  }
  const j = res.fields && res.fields.j && res.fields.j.stringValue;
  return j ? JSON.parse(j) : null;
}

/* cache the last good fetch so the widget still renders offline */
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), "dayledger-widget.json");
function readCache() { try { if (fm.fileExists(cachePath)) return JSON.parse(fm.readString(cachePath)); } catch (e) {} return null; }
function writeCache(o) { try { fm.writeString(cachePath, JSON.stringify(o)); } catch (e) {} }

async function getData() {
  const iso = todayISO();
  try {
    const token = await signIn();
    const settings = await fsGetJ(token, "users/" + CFG.uid + "/dayledger/settings");
    const day = await fsGetJ(token, "users/" + CFG.uid + "/dayledgerDays/" + iso);
    const data = { iso, settings, day, stale: false };
    writeCache(data);
    return data;
  } catch (e) {
    const c = readCache();
    if (c && c.iso === iso) { c.stale = true; return c; }   // offline: reuse today's cache
    throw e;
  }
}

/* merge consecutive slots of the same activity into blocks */
function buildBlocks(map, slotMin) {
  const keys = Object.keys(map || {}).map(Number).sort((a, b) => a - b);
  const blocks = [];
  for (const m of keys) {
    const id = map[m], last = blocks[blocks.length - 1];
    if (last && last.id === id && last.end === m) last.end = m + slotMin;
    else blocks.push({ id, start: m, end: m + slotMin });
  }
  return blocks;
}

function header(w, sub) {
  const h = w.addStack();
  h.centerAlignContent();
  const t = h.addText("DAYLEDGER");
  t.font = Font.semiboldSystemFont(9);
  t.textColor = new Color(HL);
  h.addSpacer();
  const d = h.addText(sub);
  d.font = Font.mediumSystemFont(9);
  d.textColor = new Color(SOFT);
  w.addSpacer(6);
}
function note(w, msg) {
  const t = w.addText(msg);
  t.font = Font.mediumSystemFont(12);
  t.textColor = new Color(SOFT);
  t.minimumScaleFactor = 0.7;
}

async function main() {
  const w = new ListWidget();
  w.backgroundColor = new Color(INK);
  w.setPadding(12, 14, 12, 14);
  w.url = CFG.appUrl;
  const fam = config.widgetFamily || "medium";
  const maxRows = fam === "large" ? 10 : fam === "small" ? 3 : 5;
  const compact = fam === "small";
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  try {
    if (CFG.uid.indexOf("PASTE") === 0 || CFG.password.indexOf("PASTE") === 0) {
      header(w, dateLabel);
      note(w, "Setup needed: open this script in Scriptable and fill in CFG.uid and CFG.password.");
    } else {
      const data = await getData();
      header(w, dateLabel + (data.stale ? " · offline" : ""));
      const settings = data.settings || {};
      const slotMin = +settings.slotMin >= 5 ? +settings.slotMin : 30;
      const acts = {};
      (settings.activities || []).forEach(a => acts[a.id] = a);
      const map = (data.day || {})[CFG.show] || {};
      const blocks = buildBlocks(map, slotMin);
      const upcoming = blocks.filter(b => b.end > nowMin);
      const shown = (upcoming.length ? upcoming : []).slice(0, maxRows);

      if (!blocks.length) note(w, "No " + CFG.show + " for today. Tap to open DayLedger.");
      else if (!shown.length) note(w, "Day complete ✓ (" + blocks.length + " blocks done)");
      else {
        for (const b of shown) {
          const a = acts[b.id] || { name: "?", color: "#5A6B85" };
          const current = b.start <= nowMin && nowMin < b.end;
          const row = w.addStack();
          row.centerAlignContent();
          const tt = row.addText(compact ? fmt(b.start) : fmt(b.start) + "–" + fmt(b.end));
          tt.font = Font.mediumMonospacedSystemFont(compact ? 9 : 10);
          tt.textColor = new Color(current ? HL : SOFT);
          row.addSpacer(7);
          const pill = row.addStack();
          pill.backgroundColor = new Color(a.color);
          pill.cornerRadius = 7;
          pill.setPadding(2, 8, 2, 8);
          if (current) { pill.borderWidth = 2; pill.borderColor = new Color(HL); }
          const nm = pill.addText(a.name);
          nm.font = Font.semiboldSystemFont(compact ? 10 : 12);
          nm.textColor = new Color(textColorFor(a.color));
          nm.lineLimit = 1;
          row.addSpacer();
          if (current && !compact) {
            const tag = row.addText("now");
            tag.font = Font.semiboldSystemFont(9);
            tag.textColor = new Color(HL);
          }
          w.addSpacer(4);
        }
        if (upcoming.length > shown.length) {
          const more = w.addText("+" + (upcoming.length - shown.length) + " more …");
          more.font = Font.mediumSystemFont(9);
          more.textColor = new Color(SOFT);
        }
      }
      /* refresh at the next block boundary (but not sooner than 10 min) */
      let next = nowMin + 30;
      for (const b of blocks) {
        if (b.start > nowMin) { next = Math.min(next, b.start); break; }
        if (b.end > nowMin) { next = Math.min(next, b.end); }
      }
      const refreshAt = new Date();
      refreshAt.setHours(0, 0, 0, 0);
      refreshAt.setMinutes(Math.max(next, nowMin + 10));
      w.refreshAfterDate = refreshAt;
    }
  } catch (e) {
    header(w, dateLabel);
    note(w, "⚠ " + e.message);
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  }

  if (config.runsInWidget) Script.setWidget(w);
  else await w.presentMedium();
  Script.complete();
}
main();
