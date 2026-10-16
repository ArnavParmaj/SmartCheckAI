"""
Monitor Routes
A small backend page, http://localhost:8000/monitor, showing what the local AI is doing:
engine status (Ollama, model, GPU), answer sheets being read and graded right now, and
recent backend requests. Sign in with a SmartCheck AI (Supabase) account; MONITOR_ADMINS
in backend/.env limits which accounts may open it.
"""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from auth import is_monitor_admin, sign_in, user_from_token
from agents import progress
from agents.llm import local_engine_status

router = APIRouter(prefix="/monitor", tags=["Monitor"])

COOKIE = "smartcheck_monitor"


class Credentials(BaseModel):
    email: str
    password: str


def _monitor_user(request: Request) -> Dict[str, Any]:
    user = user_from_token(request.cookies.get(COOKIE, ""))
    if not user:
        raise HTTPException(status_code=401, detail="Sign in to view the monitor.")
    if not is_monitor_admin(user):
        raise HTTPException(status_code=403, detail=f"{user['email']} is not allowed to view the monitor.")
    return user


@router.post("/login")
def monitor_login(creds: Credentials):
    token, expires_in, error = sign_in(creds.email.strip(), creds.password)
    if not token:
        return JSONResponse({"detail": "Wrong email or password." if "invalid" in (error or "").lower() else error}, status_code=401)
    user = user_from_token(token)
    if not is_monitor_admin(user):
        return JSONResponse({"detail": f"{creds.email} is not allowed to view the monitor."}, status_code=403)
    resp = JSONResponse({"email": user["email"]})
    # HttpOnly: page scripts can't read the token; Strict: other sites can't send it
    resp.set_cookie(COOKIE, token, max_age=expires_in, httponly=True, samesite="strict", path="/monitor")
    return resp


@router.post("/logout")
def monitor_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE, path="/monitor")
    return resp


@router.get("/data")
def monitor_data(request: Request):
    user = _monitor_user(request)
    return {
        "user": user["email"],
        "engine": local_engine_status(),
        "jobs": progress.jobs(),
        "activity": progress.activity(),
    }


@router.get("", response_class=HTMLResponse)
def monitor_page():
    return HTMLResponse(PAGE, headers={"Cache-Control": "no-store"})


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SmartCheck AI · Monitor</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --ink:#1b1f24; --muted:#5f6b7a; --line:#e3e7ec; --accent:#2f5bd3; --ok:#1f8a4c; --warn:#b26a00; --bad:#c62828; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:var(--bg); color:var(--ink); }
  header { display:flex; align-items:center; gap:12px; padding:14px 24px; background:var(--card); border-bottom:1px solid var(--line); }
  header h1 { font-size:16px; margin:0; flex:1; }
  main { max-width:1100px; margin:0 auto; padding:20px 24px; display:grid; gap:16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; }
  .card h2 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:0 0 12px; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; }
  .tile .v { font-size:22px; font-weight:700; }
  .tile .l { color:var(--muted); font-size:12px; }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:6px; vertical-align:middle; }
  .bar { height:8px; background:#e9edf2; border-radius:99px; overflow:hidden; margin-top:6px; }
  .bar > div { height:100%; background:var(--accent); transition:width .4s; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:7px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-size:12px; color:var(--muted); font-weight:600; }
  .muted { color:var(--muted); }
  .pill { font-size:11px; padding:2px 8px; border-radius:99px; background:#eef2fb; color:var(--accent); white-space:nowrap; }
  .pill.done { background:#e8f5ee; color:var(--ok); } .pill.err { background:#fdecec; color:var(--bad); }
  .job { border-left:4px solid var(--accent); padding:10px 12px; margin-bottom:10px; background:#fafbff; border-radius:8px; }
  .job.idle { border-color:var(--line); background:#fff; }
  button { font:inherit; border:1px solid var(--line); background:#fff; border-radius:8px; padding:6px 12px; cursor:pointer; }
  button.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
  #login { max-width:360px; margin:12vh auto; }
  #login input { width:100%; font:inherit; padding:9px 10px; border:1px solid var(--line); border-radius:8px; margin:6px 0 12px; }
  #login .err { color:var(--bad); min-height:20px; }
  .wrap { overflow-x:auto; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<section id="login" class="card" hidden>
  <h2>SmartCheck AI monitor</h2>
  <p class="muted">Sign in with your SmartCheck AI account.</p>
  <form id="loginForm">
    <label>Email<input id="email" type="email" autocomplete="username" required></label>
    <label>Password<input id="password" type="password" autocomplete="current-password" required></label>
    <div class="err" id="loginErr" role="alert"></div>
    <button class="primary" type="submit">Sign in</button>
  </form>
</section>

<div id="app" hidden>
  <header>
    <h1>SmartCheck AI · Live model monitor</h1>
    <span class="muted" id="who"></span>
    <button id="logout">Sign out</button>
  </header>
  <main>
    <section class="card">
      <h2>Local AI engine</h2>
      <div class="tiles" id="engine"></div>
    </section>
    <section class="card">
      <h2>Answer sheets in progress</h2>
      <div id="jobs"></div>
    </section>
    <section class="card">
      <h2>Recent backend activity</h2>
      <div class="wrap"><table>
        <thead><tr><th>Time</th><th>User</th><th>Request</th><th>Took</th><th>Result</th></tr></thead>
        <tbody id="activity"></tbody>
      </table></div>
    </section>
  </main>
</div>

<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ago = (t) => { const s = Math.max(0, Math.round(Date.now() / 1000 - t)); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; };
const clock = (t) => new Date(t * 1000).toLocaleTimeString();
let timer = null;

function showLogin(msg) {
  clearInterval(timer); timer = null;
  $('app').hidden = true; $('login').hidden = false; $('loginErr').textContent = msg || '';
}

function tile(value, label, color) {
  return `<div class="tile"><div class="v">${color ? `<span class="dot" style="background:${color}"></span>` : ''}${value}</div><div class="l">${label}</div></div>`;
}

function render(d) {
  $('who').textContent = d.user;
  const e = d.engine;
  const busy = d.jobs.some(j => j.active && (j.stage === 'ocr' || j.stage === 'grading'));
  $('engine').innerHTML =
    tile(e.ollama ? (busy ? 'Working' : 'Ready') : 'Not running', 'Ollama (local AI server)', e.ollama ? (busy ? 'var(--accent)' : 'var(--ok)') : 'var(--bad)') +
    tile(esc(e.model), e.loaded ? 'Model loaded in memory' : 'Model not loaded (loads on first sheet)') +
    tile(e.gpu_percent == null ? '—' : e.gpu_percent + '%', 'GPU load (whole Mac)' + (e.gpu_percent == null ? '' : `<div class="bar"><div style="width:${e.gpu_percent}%"></div></div>`)) +
    tile(esc((e.providers || []).join(', ') || 'none'), 'AI providers enabled');

  const jobs = d.jobs.filter(j => j.active).concat(d.jobs.filter(j => !j.active).slice(0, 8));
  $('jobs').innerHTML = jobs.length ? jobs.map(j => {
    const pct = j.pages ? Math.round(((j.page - (j.stage === 'ocr' ? 1 : 0)) / j.pages) * 100) : null;
    const state = j.stage === 'done' ? '<span class="pill done">Graded</span>'
      : j.active ? `<span class="pill">${j.stage === 'grading' ? 'Grading' : j.stage === 'ocr_done' ? 'Saving' : 'Reading'}</span>`
      : '<span class="pill err">Stopped</span>';
    return `<div class="job ${j.active ? '' : 'idle'}">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <strong>${esc(j.file || 'Answer sheet')}</strong>
        <span>${state} <span class="muted">${j.active ? 'running ' + ago(j.started) : 'finished ' + ago(j.updated) + ' ago'}</span></span>
      </div>
      <div class="muted">${esc(j.detail)}${j.user ? ' · ' + esc(j.user) : ''}</div>
      ${j.active && pct != null && j.stage === 'ocr' ? `<div class="bar"><div style="width:${pct}%"></div></div>` : ''}
    </div>`;
  }).join('') : '<p class="muted">No answer sheets yet. Start an evaluation in the app and it appears here.</p>';

  $('activity').innerHTML = d.activity.length ? d.activity.map(a => `<tr>
    <td>${clock(a.time)}</td><td>${esc(a.user || '—')}</td><td>${esc(a.method)} ${esc(a.path)}</td>
    <td>${a.seconds < 1 ? Math.round(a.seconds * 1000) + ' ms' : a.seconds.toFixed(1) + ' s'}</td>
    <td><span class="pill ${a.status < 400 ? 'done' : 'err'}">${a.status}</span></td></tr>`).join('')
    : '<tr><td colspan="5" class="muted">No requests yet.</td></tr>';
}

async function refresh() {
  try {
    const res = await fetch('/monitor/data', { cache: 'no-store' });
    if (res.status === 401) return showLogin();
    if (res.status === 403) return showLogin((await res.json()).detail);
    render(await res.json());
    $('login').hidden = true; $('app').hidden = false;
    if (!timer) timer = setInterval(refresh, 2000);
  } catch {
    $('who').textContent = 'Backend not reachable, retrying…';
  }
}

$('loginForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('loginErr').textContent = 'Signing in…';
  const res = await fetch('/monitor/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: $('email').value, password: $('password').value }) });
  if (!res.ok) { $('loginErr').textContent = (await res.json()).detail || 'Sign-in failed'; return; }
  $('password').value = '';
  refresh();
});
$('logout').addEventListener('click', async () => { await fetch('/monitor/logout', { method: 'POST' }); showLogin(); });
refresh();
</script>
</body>
</html>
"""
