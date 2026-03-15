"""Admin dashboard HTML — served at GET /admin"""

ADMIN_DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trading Bible — Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f1117;color:#e0e0e0;padding:24px}
h1{color:#c5a059;margin-bottom:24px;font-size:1.5rem}
h2{color:#aaa;font-size:.9rem;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:24px}
.card{background:#1a1d27;border-radius:10px;padding:18px;border:1px solid #2a2d3a}
.stat{font-size:1.8rem;font-weight:bold;color:#c5a059}.stat.warn{color:#f59e0b}.stat.error{color:#ef4444}
.label{font-size:.78rem;color:#666;margin-top:4px}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.72rem;font-weight:600}
.badge.ok{background:#064e3b;color:#34d399}.badge.warn{background:#78350f;color:#fbbf24}
.badge.off{background:#3b1f1f;color:#f87171}.badge.blue{background:#1e3a5f;color:#60a5fa}
table{width:100%;border-collapse:collapse;font-size:.83rem}
th{text-align:left;padding:9px 12px;background:#13151f;color:#555;font-weight:600;border-bottom:1px solid #2a2d3a}
td{padding:8px 12px;border-bottom:1px solid #1e2130}tr:hover td{background:#1e2130}
input,select{background:#13151f;border:1px solid #2a2d3a;color:#e0e0e0;padding:7px 11px;border-radius:6px;font-size:.85rem;width:100%}
button{padding:7px 16px;border-radius:6px;border:none;cursor:pointer;font-size:.85rem;font-weight:600;transition:opacity .15s}
button:hover{opacity:.82}
.btn-primary{background:#c5a059;color:#000}.btn-danger{background:#ef4444;color:#fff}
.btn-warn{background:#f59e0b;color:#000}.btn-sm{padding:3px 9px;font-size:.72rem}
.form-row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:10px}
.form-group{flex:1;min-width:110px}.form-group label{font-size:.72rem;color:#666;display:block;margin-bottom:3px}
.section{margin-bottom:28px}.rfbtn{float:right;margin-top:-2px}
.toast{position:fixed;bottom:20px;right:20px;background:#1a1d27;border:1px solid #2a2d3a;border-radius:8px;padding:11px 18px;font-size:.85rem;z-index:999;opacity:0;transition:opacity .3s;max-width:340px}
.toast.show{opacity:1}.toast.ok{border-left:4px solid #34d399}.toast.err{border-left:4px solid #f87171}
#log{background:#0a0c12;border-radius:8px;padding:12px;font-family:monospace;font-size:.78rem;height:130px;overflow-y:auto;color:#6ee7b7}
</style>
</head>
<body>
<h1>⚡ BullsEye Quant — Admin Dashboard</h1>
<div class="section">
  <h2>System Status <button class="btn-primary btn-sm rfbtn" onclick="loadStats()">↻ Refresh</button></h2>
  <div class="grid">
    <div class="card"><div class="stat" id="s-symbols">—</div><div class="label">Active Symbols</div></div>
    <div class="card"><div class="stat" id="s-ticker">—</div><div class="label">Kite Ticker</div></div>
    <div class="card"><div class="stat" id="s-auth">—</div><div class="label">Kite Auth</div></div>
    <div class="card"><div class="stat" id="s-ws">—</div><div class="label">WS Clients</div></div>
    <div class="card"><div class="stat" id="s-1min">—</div><div class="label">1min rows</div></div>
    <div class="card"><div class="stat" id="s-1day">—</div><div class="label">1day rows</div></div>
  </div>
</div>
<div class="section">
  <h2>Kite Authentication</h2>
  <div class="card" style="max-width:460px">
    <p style="color:#aaa;font-size:.85rem;margin-bottom:12px">Tokens expire daily. Authenticate each morning before 9:15AM IST.</p>
    <button class="btn-primary" onclick="window.location.href='/kite/login'">🔑 Login with Zerodha</button>
  </div>
</div>
<div class="section">
  <h2>Add Symbol</h2>
  <div class="card" style="max-width:620px">
    <div class="form-row">
      <div class="form-group" style="flex:2"><label>Symbol (exact NSE name)</label><input id="add-sym" placeholder="e.g. IRFC, BAJAJ-AUTO" style="text-transform:uppercase"></div>
      <div class="form-group"><label>Exchange</label><select id="add-exch"><option>NSE</option><option>BSE</option></select></div>
      <div class="form-group"><label>Backfill?</label><select id="add-bf"><option value="true">Yes</option><option value="false">No</option></select></div>
      <button class="btn-primary" onclick="addSymbol()">+ Add</button>
    </div>
  </div>
</div>
<div class="section">
  <h2>Symbols <button class="btn-primary btn-sm rfbtn" onclick="loadSymbols()">↻ Refresh</button></h2>
  <div class="card">
    <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center">
      <input id="sym-search" placeholder="Search..." style="max-width:240px" oninput="filterSymbols()">
      <label style="font-size:.78rem;color:#666;display:flex;align-items:center;gap:5px;white-space:nowrap">
        <input type="checkbox" id="show-inactive" onchange="loadSymbols()"> Show inactive
      </label>
    </div>
    <table><thead><tr><th>Symbol</th><th>Exchange</th><th>Name</th><th>Token</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody id="sym-tbody"><tr><td colspan="6" style="text-align:center;color:#555">Loading...</td></tr></tbody></table>
  </div>
</div>
<div class="section">
  <h2>Backfill Jobs <button class="btn-primary btn-sm rfbtn" onclick="loadBackfill()">↻ Refresh</button></h2>
  <div class="card">
    <div id="bf-summary" style="display:flex;gap:12px;margin-bottom:12px;font-size:.83rem;flex-wrap:wrap"></div>
    <div class="form-row" style="margin-bottom:12px">
      <div class="form-group" style="max-width:180px"><label>Symbol (blank=all)</label><input id="bf-sym" placeholder="RELIANCE"></div>
      <div class="form-group" style="max-width:150px"><label>Timeframe</label>
        <select id="bf-tf"><option value="">All 7</option><option value="1min">1min</option><option value="5min">5min</option><option value="15min">15min</option><option value="1hour">1hour</option><option value="1day">1day</option><option value="1week">1week</option><option value="1month">1month</option></select>
      </div>
      <button class="btn-warn" onclick="triggerBackfill()">▶ Run Backfill</button>
    </div>
    <table><thead><tr><th>Symbol</th><th>Timeframe</th><th>Status</th><th>Records</th><th>Completed</th><th>Error</th></tr></thead>
    <tbody id="bf-tbody"><tr><td colspan="6" style="text-align:center;color:#555">Loading...</td></tr></tbody></table>
  </div>
</div>
<div class="section"><h2>Activity Log</h2><div id="log"></div></div>
<div class="toast" id="toast"></div>
<script>
let allSymbols=[];
function log(msg,type='info'){const el=document.getElementById('log');const ts=new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'});const c=type==='error'?'#f87171':type==='warn'?'#fbbf24':'#6ee7b7';el.innerHTML+=`<span style="color:#555">[${ts}]</span> <span style="color:${c}">${msg}</span>\n`;el.scrollTop=el.scrollHeight}
function toast(msg,ok=true){const el=document.getElementById('toast');el.textContent=msg;el.className=`toast show ${ok?'ok':'err'}`;setTimeout(()=>el.className='toast',3500)}
async function api(path,opts={}){const r=await fetch(path,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||r.statusText);return d}
async function loadStats(){try{const d=await api('/admin/stats');const set=(id,val,cls='')=>{const el=document.getElementById(id);el.textContent=val;el.className='stat '+cls};set('s-symbols',d.symbols_tracked);set('s-ticker',d.ticker_running?'● Live':'○ Off',d.ticker_running?'':'warn');set('s-auth',d.kite_authenticated?'✓ OK':'✗ No',d.kite_authenticated?'':'error');set('s-ws',d.ws_clients_connected);set('s-1min',(d.tables['1min']||0).toLocaleString());set('s-1day',(d.tables['1day']||0).toLocaleString())}catch(e){log('Stats error: '+e.message,'error')}}
async function loadSymbols(){try{const inactive=document.getElementById('show-inactive').checked;const d=await api(`/admin/symbols?include_inactive=${inactive}`);allSymbols=d.symbols;renderSymbols(allSymbols)}catch(e){log('Symbols error: '+e.message,'error')}}
function renderSymbols(syms){const tb=document.getElementById('sym-tbody');if(!syms.length){tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:#555">No symbols</td></tr>';return}tb.innerHTML=syms.map(s=>`<tr><td><strong>${s.symbol}</strong></td><td>${s.exchange}</td><td style="color:#aaa">${s.name||'—'}</td><td style="color:#555;font-size:.78rem">${s.instrument_token||'—'}</td><td><span class="badge ${s.is_active?'ok':'off'}">${s.is_active?'Active':'Inactive'}</span></td><td style="display:flex;gap:5px">${s.is_active?`<button class="btn-danger btn-sm" onclick="deactivate('${s.symbol}')">Remove</button><button class="btn-warn btn-sm" onclick="backfillOne('${s.symbol}')">Backfill</button>`:`<button class="btn-primary btn-sm" onclick="reactivate('${s.symbol}')">Reactivate</button><button class="btn-danger btn-sm" onclick="deleteData('${s.symbol}')">Delete Data</button>`}</td></tr>`).join('')}
function filterSymbols(){const q=document.getElementById('sym-search').value.toLowerCase();renderSymbols(allSymbols.filter(s=>s.symbol.toLowerCase().includes(q)||(s.name||'').toLowerCase().includes(q)))}
async function addSymbol(){const sym=document.getElementById('add-sym').value.trim().toUpperCase();const exch=document.getElementById('add-exch').value;const bf=document.getElementById('add-bf').value==='true';if(!sym){toast('Enter a symbol',false);return}try{log(`Adding ${sym}...`);const d=await api('/admin/symbols',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol:sym,exchange:exch,backfill:bf})});toast(`✓ ${sym} added!`);log(`${sym} added. ${d.backfill}`);document.getElementById('add-sym').value='';loadSymbols();loadStats()}catch(e){toast(e.message,false);log(e.message,'error')}}
async function deactivate(sym){if(!confirm(`Stop tracking ${sym}?`))return;try{await api(`/admin/symbols/${sym}`,{method:'DELETE'});toast(`${sym} deactivated`);loadSymbols();loadStats()}catch(e){toast(e.message,false)}}
async function reactivate(sym){try{await api(`/admin/symbols/${sym}/reactivate`,{method:'POST'});toast(`${sym} reactivated`);loadSymbols()}catch(e){toast(e.message,false)}}
async function deleteData(sym){if(!confirm(`PERMANENTLY DELETE all data for ${sym}?`))return;try{const d=await api(`/admin/symbols/${sym}/data`,{method:'DELETE'});toast(`${sym}: ${d.rows_deleted} rows deleted`);loadSymbols()}catch(e){toast(e.message,false)}}
async function backfillOne(sym){try{await api('/admin/backfill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:[sym]})});toast(`Backfill started for ${sym}`)}catch(e){toast(e.message,false)}}
async function loadBackfill(){try{const d=await api('/admin/backfill/status');const s=d.summary;document.getElementById('bf-summary').innerHTML=`<span class="badge ok">Done: ${s.done||0}</span><span class="badge warn">Pending: ${s.pending||0}</span><span class="badge blue">Running: ${s.running||0}</span><span class="badge off">Failed: ${s.failed||0}</span>`;const failed=d.jobs.filter(j=>j.status==='failed');const running=d.jobs.filter(j=>j.status==='running');const rest=d.jobs.filter(j=>!['failed','running'].includes(j.status));const display=[...failed,...running,...rest].slice(0,60);document.getElementById('bf-tbody').innerHTML=display.map(j=>`<tr><td>${j.symbol}</td><td>${j.timeframe}</td><td><span class="badge ${j.status==='done'?'ok':j.status==='failed'?'off':j.status==='running'?'blue':'warn'}">${j.status}</span></td><td>${(j.records||0).toLocaleString()}</td><td style="color:#555;font-size:.76rem">${j.completed_at?new Date(j.completed_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'—'}</td><td style="color:#f87171;font-size:.76rem">${j.error?j.error.substring(0,40):''}</td></tr>`).join('')}catch(e){log('Backfill error: '+e.message,'error')}}
async function triggerBackfill(){const sym=document.getElementById('bf-sym').value.trim().toUpperCase();const tf=document.getElementById('bf-tf').value;const body={};if(sym)body.symbols=[sym];if(tf)body.timeframes=[tf];try{await api('/admin/backfill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});toast(`Backfill started${sym?' for '+sym:''}`);setTimeout(loadBackfill,2000)}catch(e){toast(e.message,false)}}
loadStats();loadSymbols();loadBackfill();
setInterval(loadStats,30000);setInterval(loadBackfill,10000);
</script>
</body>
</html>
"""
