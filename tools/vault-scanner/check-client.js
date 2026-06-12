
var _url = '', _games = [], _accounts = [], _activeGame = null, _activeSection = null
var _packs = [], _nsbData = { ansb: null, unban: null, ensb: null }, _selectedCars = []
var _editingPackId = null, _deletingPackId = null
var _carFilter = { tier: null, brand: null, starType: null }
var _csr2OutputFolder = '', _ensbCurrent = {}, _pendingSavePack = null
var _selMode = false, _selected = new Set()
var _debugOpen = false, _pollInterval = null
var _scanAbort = false, _multiAbort = false, _multiRunId = 0
var _previewAcct = null, _importAcct = null, _afterImportId = null
var _csr2CarsDb = [], _ownedCrdbs = new Set(), _allowDuplicates = false
var _colorPickerCar = null, _colorPickerCarIdx = -1, _selectingColor = false

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  var cfg = await apiFetch('/local/config', {}).catch(function(){ return {} })
  _url = (cfg.webappUrl || '').replace(/\\/$/, '')
  _csr2OutputFolder = cfg.csr2OutputFolder || ''
  await fetchGames()
  await reloadAccounts()
  await reloadPacks()
  // Load car database
  var carsData = await apiFetch('/csr2/cars', null).catch(function(){ return null })
  _csr2CarsDb = Array.isArray(carsData) ? carsData : []
  updateCarDbCountBadge()
  renderView()
  startPoll()
  // Silently check for car DB updates after UI is ready
  setTimeout(checkCsr2CarsUpdate, 3000)
}

function updateCarDbCountBadge() {
  var el = document.getElementById('cars-db-count')
  if (el) el.textContent = _csr2CarsDb.length ? '(' + _csr2CarsDb.length + ')' : '(empty)'
}

async function apiFetch(path, fallback) {
  var r = await fetch(path)
  if (!r.ok) return fallback
  return r.json()
}

// ─── Games ────────────────────────────────────────────────────────────────────

async function fetchGames() {
  if (!_url) { renderGames([], 'no-url'); return }
  try {
    var r = await fetch(_url + '/api/games')
    if (!r.ok) { renderGames([], 'error:' + r.status); return }
    var all = await r.json()
    _games = (Array.isArray(all) ? all : []).filter(function(g){ return g.script_enabled && g.scanner_type })
    renderGames(_games, null)
  } catch(e) { renderGames([], 'fetch-error:' + e.message) }
}

var SIDEBAR_CATS = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'gacha',    label: 'Gacha Accounts' },
  { key: 'services', label: 'Services' },
  { key: 'tools',    label: 'Tools' },
]

function renderGames(list, err) {
  var el = document.getElementById('sidebar-content')
  if (!list.length) {
    var msg = err === 'no-url' ? 'No webapp URL — open Settings' : err ? 'Failed to load (' + err + ')' : 'No scanner games found'
    el.innerHTML = '<div class="sidebar-item" style="font-size:11px;opacity:.5">' + msg + '</div>'
    _activeGame = null; _activeSection = null
    return
  }
  var catGames = {}
  for (var i = 0; i < list.length; i++) {
    var g = list[i]
    var secs = g.script_sections || []
    for (var j = 0; j < secs.length; j++) {
      if (!catGames[secs[j]]) catGames[secs[j]] = []
      catGames[secs[j]].push(g)
    }
  }
  var html = ''
  for (var c = 0; c < SIDEBAR_CATS.length; c++) {
    var cat = SIDEBAR_CATS[c]
    var games = catGames[cat.key] || []
    if (!games.length) continue
    html += '<div class="sidebar-cat" id="scat-' + cat.key + '">'
    html += '<div class="sidebar-cat-hdr" data-key="' + cat.key + '" onclick="toggleCat(this.dataset.key)">'
    html += '<span>' + cat.label + '</span>'
    html += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>'
    html += '</div><div class="sidebar-cat-items">'
    for (var gi = 0; gi < games.length; gi++) {
      var g = games[gi]
      var isActive = _activeGame && _activeGame.id === g.id && _activeSection === cat.key
      html += '<div class="sidebar-item' + (isActive ? ' active' : '') + '" data-gid="' + escH(g.id) + '" data-sec="' + cat.key + '" onclick="pickGame(this.dataset.gid,this.dataset.sec)">'
      html += gameIconHtml(g, 18) + escH(g.name || g.id) + '</div>'
    }
    html += '</div></div>'
  }
  el.innerHTML = html
  if (!_activeGame) {
    var first = el.querySelector('.sidebar-item')
    if (first) pickGame(first.dataset.gid, first.dataset.sec)
  }
}

function toggleCat(key) {
  var el = document.getElementById('scat-' + key)
  if (el) el.classList.toggle('collapsed')
}

function pickGame(gid, sec) {
  _activeGame = null
  for (var i = 0; i < _games.length; i++) { if (_games[i].id === gid) { _activeGame = _games[i]; break } }
  _activeSection = sec || null
  document.querySelectorAll('#sidebar-content .sidebar-item').forEach(function(el) {
    var active = el.dataset.gid === gid && el.dataset.sec === sec
    el.classList.toggle('active', active)
    var dot = el.querySelector('.s-dot')
    if (dot) dot.classList.toggle('on', active)
  })
  renderView()
}

function renderView() {
  var isCSR2 = _activeGame && _activeGame.scanner_type === 'csr2services'
  document.getElementById('accounts-panel').style.display = isCSR2 ? 'none' : ''
  document.getElementById('csr2-panel').style.display = isCSR2 ? '' : 'none'
  if (isCSR2) {
    renderPacks()
  } else {
    renderAccounts()
    var list = _activeGame ? _accounts.filter(function(a){ return a.gameId === _activeGame.id }) : _accounts
    var hasScan = !!_activeGame
    document.getElementById('scan-btn').style.display = hasScan ? '' : 'none'
    document.getElementById('scan-current-btn').style.display = hasScan ? '' : 'none'
    document.getElementById('multi-btn').style.display = hasScan ? '' : 'none'
    document.getElementById('unfriend-btn').style.display = hasScan ? '' : 'none'
    document.getElementById('sel-btn').style.display = list.length ? '' : 'none'
  }
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

async function reloadAccounts() {
  _accounts = await apiFetch('/local/accounts', [])
}

function renderAccounts() {
  var grid = document.getElementById('grid')
  var list = _activeGame
    ? _accounts.filter(function(a){ return a.gameId === _activeGame.id })
    : _accounts
  document.getElementById('sel-btn').style.display = list.length ? '' : 'none'
  if (!list.length) {
    grid.innerHTML = '<div class="empty"><h3>No accounts yet</h3><p>Use Single Scan or Multi Scan to add accounts.</p></div>'
    return
  }
  var html = ''
  for (var i = 0; i < list.length; i++) {
    var a = list[i]
    var name = a.summonerName ? (a.summonerName + (a.tagLine ? '#' + a.tagLine : '')) : 'Unknown'
    var skins = Array.isArray(a.ownedSkinIds) ? a.ownedSkinIds.length : 0
    var rank = a.soloRank || 'Unranked'
    var isSel = _selected.has(a.id)
    var thumbInner = (_activeGame && _activeGame.image)
      ? '<img src="' + escH(_activeGame.image) + '" class="card-game-img">'
      : '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3a4050" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>'
    html += '<div class="card' + (isSel ? ' sel' : '') + '" id="c-' + a.id + '">' +
      (_selMode ? '<div class="chk' + (isSel ? ' on' : '') + '" data-id="' + a.id + '" onclick="toggleSel(this.dataset.id,event)">' +
        (isSel ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
        '</div>' : '') +
      '<div class="card-thumb">' + thumbInner + '</div>' +
      '<div class="card-body"><div class="card-name" title="' + escH(name) + '">' + escH(name) + '</div>' +
      '<div class="card-meta"><span>' + skins + ' skins</span><span>' + escH(rank) + '</span></div></div>' +
      '<div class="card-overlay">' +
      '<button class="ov-btn ov-import" data-id="' + a.id + '" onclick="openImport(this.dataset.id,event)">Import to Webapp</button>' +
      '<button class="ov-btn ov-preview" data-id="' + a.id + '" onclick="openPreview(this.dataset.id,event)">Preview Link</button>' +
      '<button class="ov-btn ov-remove" data-id="' + a.id + '" onclick="removeAcct(this.dataset.id,event)">Remove</button>' +
      '</div></div>'
  }
  grid.innerHTML = html
}

function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function gameIconHtml(g, size) {
  size = size || 18
  var st = 'width:' + size + 'px;height:' + size + 'px;'
  if (g && g.image) return '<img src="' + escH(g.image) + '" class="game-icon" style="' + st + '">'
  var init = g && g.name ? g.name[0].toUpperCase() : '?'
  return '<span class="game-icon-init" style="' + st + '">' + escH(init) + '</span>'
}

// ─── Status Polling ───────────────────────────────────────────────────────────

function startPoll() {
  if (_pollInterval) clearInterval(_pollInterval)
  _pollInterval = setInterval(async function() {
    try {
      var s = await apiFetch('/status', {})
      var banner = document.getElementById('scan-banner')
      var grid = document.getElementById('grid')
      var gameItems = document.querySelectorAll('#games-list .sidebar-item')
      var scanBtnEl = document.getElementById('scan-btn')
      var multiBtnEl = document.getElementById('multi-btn')
      if (s.webappScanning) {
        banner.classList.add('on')
        grid.classList.add('grid-blur')
        gameItems.forEach(function(el){ el.classList.add('blur') })
        if (scanBtnEl) { scanBtnEl.disabled = true; scanBtnEl.style.opacity = '0.4'; scanBtnEl.style.cursor = 'not-allowed' }
        if (multiBtnEl) { multiBtnEl.disabled = true; multiBtnEl.style.opacity = '0.4'; multiBtnEl.style.cursor = 'not-allowed' }
      } else {
        banner.classList.remove('on')
        grid.classList.remove('grid-blur')
        gameItems.forEach(function(el){ el.classList.remove('blur') })
        if (scanBtnEl) { scanBtnEl.disabled = false; scanBtnEl.style.opacity = ''; scanBtnEl.style.cursor = '' }
        if (multiBtnEl) { multiBtnEl.disabled = false; multiBtnEl.style.opacity = ''; multiBtnEl.style.cursor = '' }
      }
    } catch(e) {}
  }, 3500)
}

// ─── Single Scan ──────────────────────────────────────────────────────────────

function openSingleScan() {
  _scanAbort = false
  resetScanModal()
  showModal('scan-modal')
  runSingleScan()
}

function closeScanModal() {
  _scanAbort = true
  hideModal('scan-modal')
}

function resetScanModal() {
  _scanAbort = false
  setStep(1, 'pending', '')
  setStep(2, 'pending', '')
  setStep(3, 'pending', '')
  hideNotice('scan-notice')
  document.getElementById('scan-retry-btn').style.display = 'none'
  document.getElementById('scan-close-btn').textContent = 'Cancel'
}

function setStep(n, state, sub) {
  var ico = document.getElementById('s' + n + '-ico')
  var subEl = document.getElementById('s' + n + '-sub')
  ico.className = 'step-ico ico-' + state
  if (state === 'active') ico.innerHTML = '<div class="spinner"></div>'
  else if (state === 'done') ico.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
  else if (state === 'error') ico.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  else ico.textContent = n
  if (subEl && sub !== undefined) subEl.textContent = sub
}

async function runSingleScan() {
  // Step 1: Riot Client
  setStep(1, 'active', 'Checking Riot Client...')
  var rc = await apiFetch('/riot/status', { running: false })
  if (_scanAbort) return
  if (!rc.running) {
    setStep(1, 'error', 'Riot Client not running')
    showNotice('scan-notice', 'error', 'Riot Client is not running. Open the Riot Client app first, then retry.')
    document.getElementById('scan-retry-btn').style.display = ''
    document.getElementById('scan-close-btn').textContent = 'Close'
    return
  }
  setStep(1, 'done', 'Riot Client detected')

  // Step 2: League Client
  setStep(2, 'active', 'Checking League client...')
  var lcuOk = await apiFetch('/ping-lcu', { ok: false }).then(function(r){ return r.ok })
  if (_scanAbort) return
  if (!lcuOk) {
    setStep(2, 'active', 'Launching League of Legends...')
    await fetch('/riot/launch-league', { method: 'POST' }).catch(function(){})
    if (_scanAbort) return
    setStep(2, 'active', 'Waiting for League to load (up to 90s)...')
    var deadline = Date.now() + 90000
    while (Date.now() < deadline && !_scanAbort) {
      await sleep(5000)
      if (_scanAbort) return
      var ping = await apiFetch('/ping-lcu', { ok: false })
      if (ping.ok) { lcuOk = true; break }
    }
    if (!lcuOk) {
      setStep(2, 'error', 'League client did not start')
      showNotice('scan-notice', 'error', 'League of Legends did not start in time. Launch it manually and retry.')
      document.getElementById('scan-retry-btn').style.display = ''
      document.getElementById('scan-close-btn').textContent = 'Close'
      return
    }
  }
  if (_scanAbort) return
  setStep(2, 'done', 'League client ready')

  // Step 3: Scan with auto-retry (5s gaps, 2 min max)
  setStep(3, 'active', 'Scanning account...')
  var result = null
  var scanDl = Date.now() + 120000
  var scanAttempt = 0
  while (Date.now() < scanDl && !_scanAbort) {
    if (scanAttempt > 0) setStep(3, 'active', 'Retrying scan (attempt ' + (scanAttempt + 1) + ')...')
    result = await fetch('/scan', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
    if (_scanAbort) return
    if (!result.error && Array.isArray(result.ownedSkinIds) && result.ownedSkinIds.length > 0) break
    scanAttempt++
    if (Date.now() < scanDl) { setStep(3, 'active', 'No data yet, retrying in 5s...'); await sleep(5000) }
  }
  if (_scanAbort) return
  if (!result || result.error) {
    setStep(3, 'error', 'Scan failed')
    showNotice('scan-notice', 'error', result ? result.error : 'Scan timed out after 2 minutes')
    document.getElementById('scan-retry-btn').style.display = ''
    document.getElementById('scan-close-btn').textContent = 'Close'
    return
  }
  setStep(3, 'done', 'Scan complete!')
  showNotice('scan-notice', 'success', 'Account scanned! Saving locally...')
  var ok = await saveLocally(result)
  if (ok) {
    await reloadAccounts()
    renderAccounts()
    await sleep(600)
    hideModal('scan-modal')
  }
}

async function retryScan() {
  document.getElementById('scan-retry-btn').style.display = 'none'
  resetScanModal()
  runSingleScan()
}

async function saveLocally(data) {
  var gameId = _activeGame ? _activeGame.id : null
  var existing = _accounts.find(function(a){ return a.summonerName === data.summonerName && a.region === data.region && a.gameId === gameId })
  var body = {
    id: existing ? existing.id : uid(),
    gameId: gameId,
    summonerName: data.summonerName || '',
    tagLine: data.tagLine || '',
    region: data.region || '',
    soloRank: data.soloRank || null,
    ownedSkinIds: data.ownedSkinIds || [],
    scanData: data,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  if (existing && existing.previewId && _url) {
    fetch(_url + '/api/lol-skins/' + existing.previewId, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresAt: new Date().toISOString() })
    }).catch(function(){})
  }
  var url = existing ? '/local/accounts/' + existing.id : '/local/accounts'
  var method = existing ? 'PATCH' : 'POST'
  var r = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(function(){ return null })
  return r && r.ok
}

// ─── Scan Current Account ────────────────────────────────────────────────────

async function scanCurrentAccount() {
  var btn = document.getElementById('scan-current-btn')
  btn.disabled = true
  btn.textContent = 'Scanning...'
  var result = await fetch('/scan', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (result.error) {
    btn.textContent = 'Scan Current'
    btn.disabled = false
    alert('Scan failed: ' + result.error)
    return
  }
  await saveLocally(result)
  await reloadAccounts()
  renderAccounts()
  btn.textContent = 'Scan Current'
  btn.disabled = false
}

// ─── Unfriend All ────────────────────────────────────────────────────────────

function openUnfriendModal() {
  hideNotice('unfriend-notice')
  var btn = document.getElementById('unfriend-confirm-btn')
  btn.disabled = false
  btn.style.display = ''
  btn.textContent = 'Remove All'
  showModal('unfriend-modal')
}

async function confirmUnfriendAll() {
  var btn = document.getElementById('unfriend-confirm-btn')
  btn.disabled = true
  btn.textContent = 'Removing...'
  hideNotice('unfriend-notice')
  var res = await fetch('/unfriend-all', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) {
    showNotice('unfriend-notice', 'error', res.error)
    btn.disabled = false
    btn.textContent = 'Remove All'
  } else {
    showNotice('unfriend-notice', 'success', 'Removed ' + res.count + ' friend' + (res.count === 1 ? '' : 's') + '.')
    btn.style.display = 'none'
  }
}

// ─── Multi Scan ───────────────────────────────────────────────────────────────

function openMultiScan() {
  _multiAbort = false
  document.getElementById('multi-creds').value = ''
  document.getElementById('multi-creds-section').style.display = ''
  document.getElementById('multi-progress').style.display = 'none'
  document.getElementById('multi-start-btn').style.display = ''
  document.getElementById('multi-close-btn').textContent = 'Cancel'
  hideNotice('multi-notice')
  showModal('multi-modal')
}

function closeMultiModal() {
  _multiAbort = true
  hideModal('multi-modal')
}

async function startMultiScan() {
  var raw = document.getElementById('multi-creds').value.trim()
  if (!raw) { showNotice('multi-notice', 'error', 'Enter at least one username:password pair.'); return }
  var creds = raw.split('\\n').map(function(l){ return l.trim() }).filter(function(l){ return l.indexOf(':') > 0 })
  if (!creds.length) { showNotice('multi-notice', 'error', 'No valid credentials. Format: username:password'); return }
  document.getElementById('multi-creds-section').style.display = 'none'
  document.getElementById('multi-start-btn').style.display = 'none'
  document.getElementById('multi-progress').style.display = ''
  document.getElementById('multi-close-btn').textContent = 'Stop'
  hideNotice('multi-notice')
  _multiAbort = false
  _multiRunId++
  await runMultiLoop(creds, _multiRunId)
}

async function runMultiLoop(creds, myRunId) {
  var stepsEl = document.getElementById('multi-steps')
  var progEl = document.getElementById('multi-prog-label')
  function aborted() { return _multiAbort || _multiRunId !== myRunId }

  function addStep(label) {
    stepsEl.innerHTML += '<div class="step"><div class="step-ico ico-active"><div class="spinner"></div></div><div class="step-info"><div class="step-main">' + label + '</div></div></div>'
  }
  function markLastDone() {
    var actives = stepsEl.querySelectorAll('.ico-active')
    if (!actives.length) return
    var last = actives[actives.length - 1]
    last.className = 'step-ico ico-done'
    last.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
  }
  function markLastError() {
    var actives = stepsEl.querySelectorAll('.ico-active')
    if (!actives.length) return
    var last = actives[actives.length - 1]
    last.className = 'step-ico ico-error'
    last.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  }
  async function clientLog(msg) {
    await fetch('/debug-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) }).catch(function(){})
  }

  for (var i = 0; i < creds.length; i++) {
    if (aborted()) break
    var parts = creds[i].split(':')
    var username = parts[0]
    var password = parts.slice(1).join(':')
    progEl.textContent = 'Account ' + (i + 1) + ' of ' + creds.length + ': ' + username
    stepsEl.innerHTML = ''

    // Restart Riot Client to get a completely fresh auth session
    addStep('Restarting Riot Client...')
    await fetch('/riot/restart-client', { method: 'POST' }).catch(function(){})
    var rcReady = false
    var rcDl = Date.now() + 45000
    while (Date.now() < rcDl && !aborted()) {
      await sleep(2000)
      var rcStatus = await apiFetch('/riot/status', { running: false })
      if (rcStatus.running) { rcReady = true; break }
    }
    if (aborted()) break
    if (!rcReady) {
      markLastError()
      showNotice('multi-notice', 'error', 'Riot Client did not start — check install path.')
      break
    }
    await sleep(6000)
    markLastDone()
    if (aborted()) break

    // Login via SendKeys
    addStep('Logging in as ' + escH(username) + '...')
    await clientLog('multi-scan: firing sendkeys for ' + username)
    await fetch('/riot/sendkeys-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, password: password }) }).catch(function(){})
    if (aborted()) break
    var loggedIn = false
    var loginDl = Date.now() + 35000
    while (Date.now() < loginDl && !aborted()) {
      await sleep(2000)
      var authState = await apiFetch('/riot/auth-state', { state: null })
      await clientLog('multi-scan: auth-state poll = ' + authState.state)
      if (authState.state === 'authenticated') { loggedIn = true; break }
    }
    if (aborted()) break
    if (!loggedIn) {
      markLastError()
      showNotice('multi-notice', 'error', username + ': Login failed — check credentials or Riot Client focus.')
      await sleep(2000)
      continue
    }
    markLastDone()
    if (aborted()) break
    await sleep(3000) // give RC a moment to fully settle after login before launching

    // Check League patch state — only pause if we explicitly detect update/repair
    addStep('Checking League...')
    var leagueState = await apiFetch('/riot/league-patch-state', { skip: true })
    await clientLog('league-patch-state: ' + JSON.stringify(leagueState))
    markLastDone()
    if (aborted()) break

    if (!leagueState.skip && (leagueState.needs_patch || leagueState.needs_repair || leagueState.patching)) {
      var patchLabel = leagueState.needs_repair ? 'League needs repair — please repair in Riot Client, waiting...' : 'League needs update — please update in Riot Client, waiting...'
      addStep(patchLabel)
      // Pause and poll until League is ready — no auto-patching
      var patchDone = false
      var patchDl = Date.now() + 45 * 60 * 1000
      while (Date.now() < patchDl && !aborted()) {
        await sleep(15000)
        var ps = await apiFetch('/riot/league-patch-state', { skip: true })
        await clientLog('patch-progress: ' + JSON.stringify(ps))
        if (ps.skip || ps.ready) { patchDone = true; break }
      }
      if (aborted()) break
      if (!patchDone) {
        markLastError()
        showNotice('multi-notice', 'error', username + ': League update timed out (45 min).')
        continue
      }
      markLastDone()
      if (aborted()) break
    }

    // Launch League
    addStep('Launching League...')
    await clientLog('multi-scan: calling launch-league')
    var launchRes = await fetch('/riot/launch-league', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
    await clientLog('multi-scan: launch-league result = ' + JSON.stringify(launchRes))
    if (aborted()) break
    markLastDone()

    // Wait for League LCU (90s)
    addStep('Waiting for League client (up to 90s)...')
    var ready = false
    var dl = Date.now() + 90000
    while (Date.now() < dl && !aborted()) {
      await sleep(5000)
      var p = await apiFetch('/ping-lcu', { ok: false })
      if (p.ok) { ready = true; break }
    }
    if (aborted()) break
    if (!ready) {
      markLastError()
      showNotice('multi-notice', 'error', username + ': League did not start in 90s, skipping.')
      await sleep(1500)
      continue
    }
    markLastDone()

    // Scan with auto-retry (5s gaps, 2 min max)
    addStep('Scanning...')
    var result = null
    var scanDl = Date.now() + 120000
    while (Date.now() < scanDl && !aborted()) {
      result = await fetch('/scan', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
      if (aborted()) break
      if (!result.error && Array.isArray(result.ownedSkinIds) && result.ownedSkinIds.length > 0) break
      if (Date.now() < scanDl) await sleep(5000)
    }
    if (aborted()) break
    if (!result || result.error) {
      markLastError()
      showNotice('multi-notice', 'error', username + ': Scan failed — ' + (result ? result.error : 'timed out'))
    } else {
      markLastDone()
      await saveLocally(result)
      await reloadAccounts()
      renderAccounts()
      // Unfriend all if toggle is enabled
      if (document.getElementById('multi-unfriend-toggle').checked) {
        addStep('Unfriending all friends...')
        var ufRes = await fetch('/unfriend-all', { method: 'POST' }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
        if (ufRes.error) { markLastError() } else { markLastDone() }
      }
    }
    await sleep(2000)
  }
  if (!aborted()) {
    progEl.textContent = 'All done!'
    document.getElementById('multi-close-btn').textContent = 'Close'
  }
}

// ─── Preview Link ─────────────────────────────────────────────────────────────

function openPreview(id, e) {
  if (e) e.stopPropagation()
  _previewAcct = _accounts.find(function(a){ return a.id === id })
  if (!_previewAcct) return
  document.getElementById('prev-link-box').style.display = 'none'
  document.getElementById('prev-gen-btn').style.display = ''
  document.getElementById('prev-hide').checked = true
  document.getElementById('prev-expiry').value = '7'
  hideNotice('prev-notice')
  showModal('preview-modal')
}

function closePreviewModal() { hideModal('preview-modal') }

async function generateLink() {
  if (!_previewAcct) return
  if (!_url) { showNotice('prev-notice', 'error', 'Webapp URL not set — open Settings first.'); return }
  document.getElementById('prev-gen-btn').style.display = 'none'
  showNotice('prev-notice', 'info', 'Generating link...')
  var hideName = document.getElementById('prev-hide').checked
  var days = parseInt(document.getElementById('prev-expiry').value)
  var d = _previewAcct.scanData || {}
  var skinCount = Array.isArray(d.ownedSkinIds) ? d.ownedSkinIds.length : (Array.isArray(_previewAcct.ownedSkinIds) ? _previewAcct.ownedSkinIds.length : 0)
  var body = {
    summonerName: d.summonerName || '', tagLine: d.tagLine || '', region: d.region || '',
    profileIconId: d.profileIconId || null, summonerLevel: d.summonerLevel || null,
    soloRank: d.soloRank || null, flexRank: d.flexRank || null,
    soloPeakRank: d.soloPeakRank || null, soloPrevRank: d.soloPrevRank || null,
    rp: d.rp || null, be: d.be || null,
    ownedSkinIds: d.ownedSkinIds || [], ownedChromaIds: d.ownedChromaIds || [],
    ownedEmoteIds: d.ownedEmoteIds || [], ownedIconIds: d.ownedIconIds || [],
    lootSummary: d.lootSummary || null, rankHistory: d.rankHistory || null,
    champCount: d.champCount || null, championMastery: d.championMastery || null,
    lastMatch: d.lastMatch || null,
    hideName: hideName,
    expiresAt: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
    accountTitle: skinCount + ' Skins Account',
  }
  var res = await fetch(_url + '/api/lol-skins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) {
    showNotice('prev-notice', 'error', 'Failed: ' + res.error)
    document.getElementById('prev-gen-btn').style.display = ''
    return
  }
  var acct = _accounts.find(function(a){ return a.id === _previewAcct.id })
  if (acct) {
    acct.previewId = res.id
    fetch('/local/accounts/' + acct.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewId: res.id }) }).catch(function(){})
  }
  var link = 'https://lolprev.site/preview/lol/' + res.id
  document.getElementById('prev-link-text').textContent = link
  document.getElementById('prev-link-box').style.display = ''
  showNotice('prev-notice', 'success', 'Link created! Expires ' + (days > 0 ? 'in ' + days + ' day(s)' : 'never') + '.')
}

function copyLink() {
  var txt = document.getElementById('prev-link-text').textContent
  navigator.clipboard.writeText(txt).catch(function(){})
  var btn = document.getElementById('prev-copy-btn')
  btn.textContent = 'Copied!'
  setTimeout(function(){ btn.textContent = 'Copy' }, 2000)
}

// ─── Import to Webapp ─────────────────────────────────────────────────────────

function openImport(id, e) {
  if (e) e.stopPropagation()
  _importAcct = _accounts.find(function(a){ return a.id === id })
  if (!_importAcct) return
  var name = _importAcct.summonerName || 'Unknown'
  var skins = Array.isArray(_importAcct.ownedSkinIds) ? _importAcct.ownedSkinIds.length : 0
  document.getElementById('import-acct-info').textContent = name + ' — ' + skins + ' skins'
  document.getElementById('import-confirm-btn').disabled = false
  hideNotice('import-notice')
  showModal('import-modal')
}

function closeImportModal() { hideModal('import-modal') }

async function doImport() {
  if (!_importAcct) return
  if (!_url) { showNotice('import-notice', 'error', 'Webapp URL not set — open Settings first.'); return }
  document.getElementById('import-confirm-btn').disabled = true
  showNotice('import-notice', 'info', 'Sending to webapp...')
  var d = _importAcct.scanData || {}
  var skinCount = Array.isArray(d.ownedSkinIds) ? d.ownedSkinIds.length : 0
  var body = {
    summonerName: d.summonerName || '', tagLine: d.tagLine || '', region: d.region || '',
    profileIconId: d.profileIconId || null, summonerLevel: d.summonerLevel || null,
    soloRank: d.soloRank || null, flexRank: d.flexRank || null,
    soloPeakRank: d.soloPeakRank || null, soloPrevRank: d.soloPrevRank || null,
    rp: d.rp || null, be: d.be || null,
    ownedSkinIds: d.ownedSkinIds || [], ownedChromaIds: d.ownedChromaIds || [],
    ownedEmoteIds: d.ownedEmoteIds || [], ownedIconIds: d.ownedIconIds || [],
    lootSummary: d.lootSummary || null, rankHistory: d.rankHistory || null,
    champCount: d.champCount || null, championMastery: d.championMastery || null,
    lastMatch: d.lastMatch || null, accountTitle: skinCount + ' Skins Account',
  }
  var res = await fetch(_url + '/api/lol-skins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) {
    showNotice('import-notice', 'error', 'Import failed: ' + res.error)
    document.getElementById('import-confirm-btn').disabled = false
    return
  }
  // Save as pending import — webapp will show a notification on next visit
  var pending = { scanId: res.id, accountName: (_importAcct.summonerName || 'Unknown') + (skinCount ? ' · ' + skinCount + ' skins' : ''), importedAt: Date.now() }
  await fetch('/local/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign(await fetch('/local/config').then(function(r){ return r.json() }).catch(function(){ return {} }), { pendingImport: pending })) }).catch(function(){})
  _afterImportId = _importAcct.id
  hideModal('import-modal')
  showModal('after-import-modal')
}

function afterKeep() { hideModal('after-import-modal'); _afterImportId = null }

async function afterRemove() {
  if (_afterImportId) {
    await fetch('/local/accounts/' + _afterImportId, { method: 'DELETE' }).catch(function(){})
    await reloadAccounts()
    renderAccounts()
  }
  hideModal('after-import-modal')
  _afterImportId = null
}

// ─── Remove ───────────────────────────────────────────────────────────────────

async function removeAcct(id, e) {
  if (e) e.stopPropagation()
  await fetch('/local/accounts/' + id, { method: 'DELETE' }).catch(function(){})
  await reloadAccounts()
  renderAccounts()
}

// ─── Select Mode ──────────────────────────────────────────────────────────────

function toggleSelect() {
  _selMode = !_selMode
  _selected.clear()
  document.getElementById('sel-btn').textContent = _selMode ? 'Cancel' : 'Select'
  document.getElementById('sel-bar').classList.toggle('hide', !_selMode)
  renderAccounts()
}

function clearSel() {
  _selMode = false
  _selected.clear()
  document.getElementById('sel-btn').textContent = 'Select'
  document.getElementById('sel-bar').classList.add('hide')
  renderAccounts()
}

function toggleSel(id, e) {
  if (e) e.stopPropagation()
  if (_selected.has(id)) _selected.delete(id)
  else _selected.add(id)
  document.getElementById('sel-count').textContent = _selected.size + ' selected'
  renderAccounts()
}

async function deleteSel() {
  var ids = Array.from(_selected)
  for (var i = 0; i < ids.length; i++) {
    await fetch('/local/accounts/' + ids[i], { method: 'DELETE' }).catch(function(){})
  }
  clearSel()
  await reloadAccounts()
  renderAccounts()
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function openSettings() {
  document.getElementById('cfg-url').value = _url
  hideNotice('cfg-notice')
  showModal('settings-modal')
}

function closeSettings() { hideModal('settings-modal') }

async function saveSettings() {
  var u = document.getElementById('cfg-url').value.trim().replace(/\\/$/, '')
  await fetch('/local/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webappUrl: u }) }).catch(function(){})
  _url = u
  showNotice('cfg-notice', 'success', 'Saved!')
  setTimeout(function(){ closeSettings() }, 700)
  await fetchGames()
}

// ─── Debug ────────────────────────────────────────────────────────────────────

function toggleDebug() {
  _debugOpen = !_debugOpen
  document.getElementById('debug-panel').classList.toggle('open', _debugOpen)
  if (_debugOpen) refreshLogs()
}

async function refreshLogs() {
  var data = await apiFetch('/debug-logs', { logs: [] })
  var el = document.getElementById('debug-log')
  el.innerHTML = (data.logs || []).map(function(l){ return '<div class="log-line">' + escH(l) + '</div>' }).join('')
  el.scrollTop = el.scrollHeight
}

async function clearLogs() {
  await fetch('/debug-logs', { method: 'DELETE' }).catch(function(){})
  document.getElementById('debug-log').innerHTML = ''
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function showModal(id) { document.getElementById(id).classList.add('on') }
function hideModal(id) { document.getElementById(id).classList.remove('on') }

function showNotice(elId, type, msg) {
  var el = document.getElementById(elId)
  if (!el) return
  el.style.display = 'block'
  el.className = 'notice n-' + type
  el.textContent = msg
}

function hideNotice(elId) {
  var el = document.getElementById(elId)
  if (el) el.style.display = 'none'
}

function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms) }) }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

// ─── CSR2 Packs ───────────────────────────────────────────────────────────────

async function reloadPacks() {
  _packs = await apiFetch('/csr2/packs', [])
}

function renderPacks() {
  var grid = document.getElementById('packs-grid')
  if (!_packs.length) {
    grid.innerHTML = '<div class="empty"><h3>No packs yet</h3><p>Click <b>+ Create Pack</b> to define a service pack.</p></div>'
    return
  }
  var thumb = (_activeGame && _activeGame.image)
    ? '<img src="' + escH(_activeGame.image) + '" class="card-game-img">'
    : '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3a4050" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M12 9v6"/></svg>'
  var html = ''
  for (var i = 0; i < _packs.length; i++) {
    var p = _packs[i]
    html += '<div class="card" id="pk-' + p.id + '" data-pid="' + p.id + '">'
    html += '<div class="card-thumb">' + thumb + '</div>'
    html += '<div class="card-body"><div class="card-name">' + escH(p.name || 'Unnamed Pack') + '</div></div>'
    html += '<div class="card-overlay">'
    html += '<button class="ov-btn ov-import" data-pid="' + p.id + '" onclick="openEditNsb(this.dataset.pid)">Apply Pack</button>'
    html += '<button class="ov-btn ov-remove" data-pid="' + p.id + '" onclick="deletePack(event,this.dataset.pid)">Delete</button>'
    html += '</div></div>'
  }
  grid.innerHTML = html
}

function fmtN(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M'
  if (n >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K'
  return String(n)
}

function buildPackMeta(p) {
  var rows = []
  var c = p.currencies || {}
  var parts = []
  if (c.cash)       parts.push(fmtN(c.cash) + ' Cash')
  if (c.gold)       parts.push(fmtN(c.gold) + ' Gold')
  if (c.bronzeKeys) parts.push(fmtN(c.bronzeKeys) + ' Bk')
  if (c.silverKeys) parts.push(fmtN(c.silverKeys) + ' Sk')
  if (c.goldKeys)   parts.push(fmtN(c.goldKeys) + ' Gk')
  if (c.fuel)       parts.push(fmtN(c.fuel) + ' Fuel')
  if (parts.length) rows.push('<div class="pack-meta-row">' + parts.map(function(t){ return '<span>' + escH(t) + '</span>' }).join('<span style="color:var(--border)">·</span>') + '</div>')
  var fusion = []
  if (c.fusionGreen)  fusion.push('<span class="token-dot" style="background:#4caf50"></span>' + fmtN(c.fusionGreen))
  if (c.fusionBlue)   fusion.push('<span class="token-dot" style="background:#2196F3"></span>' + fmtN(c.fusionBlue))
  if (c.fusionRed)    fusion.push('<span class="token-dot" style="background:#e05252"></span>' + fmtN(c.fusionRed))
  if (c.fusionYellow) fusion.push('<span class="token-dot" style="background:#FFC107"></span>' + fmtN(c.fusionYellow))
  if (fusion.length) rows.push('<div class="pack-meta-row">' + fusion.join('') + '</div>')
  if (p.cars && p.cars.carMode) {
    rows.push('<div class="pack-meta-row"><span>' + escH(fmtN(p.cars.count) + ' cars · ' + p.cars.carMode + (p.cars.condition === 'maxed' ? ' · Maxed' : '')) + '</span></div>')
  }
  return rows.length ? rows : ['<div class="pack-meta-row"><span>No modifiers</span></div>']
}

function deletePack(e, id) {
  e.stopPropagation()
  _deletingPackId = id
  var pack = _packs.find(function(p){ return p.id === id })
  document.getElementById('del-pack-name').textContent = pack ? (pack.name || 'this pack') : 'this pack'
  showModal('delete-pack-modal')
}

async function confirmDeletePack() {
  if (!_deletingPackId) return
  hideModal('delete-pack-modal')
  await fetch('/csr2/packs/' + _deletingPackId, { method: 'DELETE' }).catch(function(){})
  _deletingPackId = null
  await reloadPacks()
  renderPacks()
}

// ─── Create Pack Modal ────────────────────────────────────────────────────────

function toggleCarsSection() {
  var on = document.getElementById('cp-cars-toggle').checked
  document.getElementById('cp-cars-section').style.display = on ? '' : 'none'
}

function openCreatePack() {
  _editingPackId = null
  document.getElementById('cp-title-label').textContent = 'Create Pack'
  document.getElementById('cp-name').value = ''
  document.getElementById('cp-cash').value = ''
  document.getElementById('cp-gold').value = ''
  document.getElementById('cp-bkeys').value = ''
  document.getElementById('cp-skeys').value = ''
  document.getElementById('cp-gkeys').value = ''
  document.getElementById('cp-fuel').value = ''
  document.getElementById('cp-fgreen').value = ''
  document.getElementById('cp-fblue').value = ''
  document.getElementById('cp-fred').value = ''
  document.getElementById('cp-fyellow').value = ''
  document.getElementById('cp-cars-toggle').checked = false
  document.getElementById('cp-cars-section').style.display = 'none'
  document.getElementById('cp-car-count').value = ''
  document.getElementById('cp-car-condition').value = 'stock'
  document.getElementById('cp-car-mode').value = 'random'
  document.getElementById('cp-ver-toggle').checked = false
  document.getElementById('cp-ver-section').style.display = 'none'
  document.getElementById('cp-version').value = ''
  hideNotice('cp-notice')
  showModal('create-pack-modal')
}

async function savePack() {
  var name = document.getElementById('cp-name').value.trim()
  if (!name) { showNotice('cp-notice', 'error', 'Enter a pack name.'); return }
  var currencies = {}
  var cash = parseInt(document.getElementById('cp-cash').value) || 0
  var gold = parseInt(document.getElementById('cp-gold').value) || 0
  var bkeys = parseInt(document.getElementById('cp-bkeys').value) || 0
  var skeys = parseInt(document.getElementById('cp-skeys').value) || 0
  var gkeys = parseInt(document.getElementById('cp-gkeys').value) || 0
  var fuel    = parseInt(document.getElementById('cp-fuel').value)    || 0
  var fgreen  = parseInt(document.getElementById('cp-fgreen').value)  || 0
  var fblue   = parseInt(document.getElementById('cp-fblue').value)   || 0
  var fred    = parseInt(document.getElementById('cp-fred').value)    || 0
  var fyellow = parseInt(document.getElementById('cp-fyellow').value) || 0
  if (cash)    currencies.cash = cash
  if (gold)    currencies.gold = gold
  if (bkeys)   currencies.bronzeKeys = bkeys
  if (skeys)   currencies.silverKeys = skeys
  if (gkeys)   currencies.goldKeys = gkeys
  if (fuel)    currencies.fuel = fuel
  if (fgreen)  currencies.fusionGreen = fgreen
  if (fblue)   currencies.fusionBlue = fblue
  if (fred)    currencies.fusionRed = fred
  if (fyellow) currencies.fusionYellow = fyellow
  var carsOn = document.getElementById('cp-cars-toggle').checked
  var cars = carsOn ? {
    count: parseInt(document.getElementById('cp-car-count').value) || 0,
    condition: document.getElementById('cp-car-condition').value,
    carMode: document.getElementById('cp-car-mode').value,
  } : null
  var version = document.getElementById('cp-ver-toggle').checked ? (document.getElementById('cp-version').value.trim() || null) : null
  var pack = { name, currencies, cars, version: version || undefined }
  var url = _editingPackId ? '/csr2/packs/' + _editingPackId : '/csr2/packs'
  var method = _editingPackId ? 'PATCH' : 'POST'
  var res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pack) }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.error) { showNotice('cp-notice', 'error', res.error); return }
  hideModal('create-pack-modal')
  await reloadPacks()
  renderPacks()
}

// ─── Apply NSB Modal + Car DB ──────────────────────────────────────────────────

async function openCarsUpdate() {
  document.getElementById('cars-update-status').textContent = 'Checking GitHub for updates...'
  document.getElementById('cars-update-info').textContent = ''
  document.getElementById('cars-update-bar-fill').style.width = '0%'
  document.getElementById('cars-update-go-btn').style.display = 'none'
  document.getElementById('cars-update-close-btn').textContent = 'Close'
  hideNotice('cars-update-notice')
  showModal('cars-update-modal')
  try {
    var res = await fetch('/csr2/cars-check').then(function(r){ return r.json() })
    if (res.error) {
      document.getElementById('cars-update-status').textContent = 'Could not reach GitHub.'
      document.getElementById('cars-update-info').textContent = res.error
      return
    }
    var count = res.carCount || 0
    if (count === 0) {
      document.getElementById('cars-update-status').textContent = 'Car database is empty.'
      document.getElementById('cars-update-info').textContent = 'Download the full car list from GitHub to enable the car picker.'
    } else if (res.hasUpdate) {
      document.getElementById('cars-update-status').textContent = 'Update available!'
      document.getElementById('cars-update-info').textContent = 'Current: ' + count + ' cars. A newer version is available on GitHub.'
    } else {
      document.getElementById('cars-update-status').textContent = 'Car database is up to date.'
      document.getElementById('cars-update-info').textContent = count + ' cars loaded.'
    }
    document.getElementById('cars-update-go-btn').style.display = (count === 0 || res.hasUpdate) ? '' : 'none'
  } catch (e) {
    document.getElementById('cars-update-status').textContent = 'Check failed: ' + e.message
  }
}

async function doCarsUpdate() {
  document.getElementById('cars-update-go-btn').style.display = 'none'
  document.getElementById('cars-update-close-btn').textContent = 'Cancel'
  document.getElementById('cars-update-status').textContent = 'Downloading car database from GitHub...'
  document.getElementById('cars-update-bar-fill').style.width = '30%'
  hideNotice('cars-update-notice')
  try {
    var res = await fetch('/csr2/cars-update', { method: 'POST' }).then(function(r){ return r.json() })
    if (res.error) { showNotice('cars-update-notice', 'error', res.error); document.getElementById('cars-update-close-btn').textContent = 'Close'; return }
    document.getElementById('cars-update-bar-fill').style.width = '100%'
    document.getElementById('cars-update-status').textContent = 'Done! ' + res.count + ' cars loaded.'
    document.getElementById('cars-update-close-btn').textContent = 'Close'
    // Reload car DB
    var carsData = await fetch('/csr2/cars').then(function(r){ return r.json() }).catch(function(){ return [] })
    _csr2CarsDb = Array.isArray(carsData) ? carsData : []
    updateCarDbCountBadge()
    showNotice('cars-update-notice', 'success', res.count + ' cars ready.')
  } catch (e) {
    showNotice('cars-update-notice', 'error', 'Update failed: ' + e.message)
    document.getElementById('cars-update-close-btn').textContent = 'Close'
  }
}

async function checkCsr2CarsUpdate() {
  if (_csr2CarsDb.length === 0) return  // already empty — user will notice the badge
  try {
    var res = await fetch('/csr2/cars-check').then(function(r){ return r.json() })
    if (res.hasUpdate) {
      var btn = document.getElementById('cars-update-btn')
      if (btn) btn.style.borderColor = 'var(--accent)'
    }
  } catch {}
}

function openEditNsb(packId) {
  _nsbData.ansb = null
  _selectedCars = []
  _carFilter = { tier: null, brand: null, starType: null }
  _ownedCrdbs = new Set()
  _allowDuplicates = false
  document.getElementById('ansb-file-name').style.display = 'none'
  document.getElementById('ansb-compare').style.display = 'none'
  document.getElementById('ansb-apply-btn').disabled = true
  document.getElementById('ansb-drop').classList.remove('over')
  document.getElementById('ansb-car-search').value = ''
  document.getElementById('ansb-car-results').innerHTML = ''
  var dupChk = document.getElementById('ansb-allow-dup')
  if (dupChk) dupChk.checked = false
  hideNotice('ansb-notice')
  renderSelectedCars()

  var pack = null
  if (!packId) {
    var sel = document.getElementById('ansb-pack-select')
    sel.innerHTML = _packs.map(function(p){ return '<option value="' + escH(p.id) + '">' + escH(p.name || 'Unnamed') + '</option>' }).join('')
    delete sel.dataset.forcedId
    document.getElementById('ansb-pack-select-row').style.display = ''
    pack = _packs[0] || null
  } else {
    pack = _packs.find(function(p){ return p.id === packId })
    var sel2 = document.getElementById('ansb-pack-select')
    sel2.value = packId
    sel2.dataset.forcedId = packId
    document.getElementById('ansb-pack-select-row').style.display = 'none'
  }

  renderPackInfoInModal(pack)
  showModal('apply-nsb-modal')
}

function openEditNsbManual() {
  _nsbData.ensb = null
  _ensbCurrent = {}
  document.getElementById('ensb-file-name').style.display = 'none'
  document.getElementById('ensb-form').style.display = 'none'
  document.getElementById('ensb-apply-btn').disabled = true
  document.getElementById('ensb-unban-btn').disabled = true
  document.getElementById('ensb-drop').classList.remove('over')
  hideNotice('ensb-notice')
  var fields = ['cash','gold','bkeys','skeys','gkeys','fuel','fgreen','fblue','fred','fyellow']
  for (var i = 0; i < fields.length; i++) {
    var el = document.getElementById('ensb-' + fields[i])
    if (el) el.value = '0'
    var af = document.getElementById('ensb-' + fields[i] + '-after')
    if (af) af.textContent = '—'
  }
  showModal('edit-nsb-modal')
}

function renderPackInfoInModal(pack) {
  var box = document.getElementById('ansb-pack-info')
  var outer = document.getElementById('ansb-outer')
  var carSection = document.getElementById('ansb-car-section')
  if (!pack) { box.innerHTML = ''; outer.classList.remove('has-cars'); carSection.style.display = 'none'; return }

  var c = pack.currencies || {}
  var chips = []
  if (c.cash)       chips.push({val: fmtN(c.cash),       lbl: 'Cash',        em: '💵'})
  if (c.gold)       chips.push({val: fmtN(c.gold),       lbl: 'Gold',        em: '🪙'})
  if (c.bronzeKeys) chips.push({val: fmtN(c.bronzeKeys), lbl: 'Bronze Keys', em: '🔑'})
  if (c.silverKeys) chips.push({val: fmtN(c.silverKeys), lbl: 'Silver Keys', em: '🗝️'})
  if (c.goldKeys)   chips.push({val: fmtN(c.goldKeys),   lbl: 'Gold Keys',   em: '✨'})
  if (c.fuel)       chips.push({val: fmtN(c.fuel),       lbl: 'Fuel',        em: '⛽'})

  var html = '<div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px">' + escH(pack.name || 'Pack Contents') + '</div>'

  if (chips.length) {
    html += '<div class="pack-stat-grid">'
    for (var i = 0; i < chips.length; i++) {
      html += '<div class="pack-stat-chip"><span class="psc-val">' + chips[i].em + ' ' + escH(chips[i].val) + '</span><span class="psc-lbl">' + escH(chips[i].lbl) + '</span></div>'
    }
    html += '</div>'
  }

  var fusion = []
  if (c.fusionGreen)  fusion.push('<span class="token-dot" style="background:#4caf50"></span><span>' + fmtN(c.fusionGreen) + ' Green</span>')
  if (c.fusionBlue)   fusion.push('<span class="token-dot" style="background:#2196F3"></span><span>' + fmtN(c.fusionBlue) + ' Blue</span>')
  if (c.fusionRed)    fusion.push('<span class="token-dot" style="background:#e05252"></span><span>' + fmtN(c.fusionRed) + ' Red</span>')
  if (c.fusionYellow) fusion.push('<span class="token-dot" style="background:#FFC107"></span><span>' + fmtN(c.fusionYellow) + ' Yellow</span>')
  if (fusion.length) {
    html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:.5px">Fusion:</span>' + fusion.join('') + '</div>'
  }

  if (pack.cars && pack.cars.count) {
    html += '<div style="font-size:12px;color:var(--muted);margin-top:4px">🚗 ' + fmtN(pack.cars.count) + ' cars &middot; ' + escH(pack.cars.carMode || 'random') + (pack.cars.condition === 'maxed' ? ' &middot; maxed' : '') + '</div>'
  }

  box.innerHTML = html

  var isCustom = !!(pack.cars && pack.cars.carMode === 'customizable')
  carSection.style.display = isCustom ? '' : 'none'
  if (isCustom) {
    outer.classList.add('has-cars')
    renderCarFilterBar()
    setCarSectionLocked(!_nsbData.ansb)
  } else {
    outer.classList.remove('has-cars')
  }
}

function renderCarFilterBar() {
  var tierBar  = document.getElementById('ansb-tier-filters')
  var starBar  = document.getElementById('ansb-star-filters')
  var brandBar = document.getElementById('ansb-brand-filters')
  if (!tierBar) return
  var t = _carFilter.tier
  tierBar.innerHTML = ['All',1,2,3,4,5].map(function(v){
    var active = (v === 'All' && !t) || v === t
    return '<span class="car-filter-chip' + (active?' active':'') + '" onclick="setTierFilter(\'' + v + '\')">' + (v === 'All' ? 'All' : 'T'+v) + '</span>'
  }).join('')
  if (starBar) {
    var s = _carFilter.starType
    starBar.innerHTML = [
      {v:'All', l:'⭐ All Stars'}, {v:'Gold', l:'⭐ Gold'}, {v:'Purple', l:'💜 Purple'}, {v:'Legends', l:'🌟 Legends'},
    ].map(function(x){
      var active = (x.v === 'All' && !s) || x.v === s
      return '<span class="car-filter-chip' + (active?' active':'') + '" onclick="setStarFilter(\'' + x.v + '\')">' + x.l + '</span>'
    }).join('')
  }
  if (brandBar) {
    var b = _carFilter.brand
    var brands = []
    for (var i = 0; i < _csr2CarsDb.length; i++) {
      if (_csr2CarsDb[i].brand && brands.indexOf(_csr2CarsDb[i].brand) === -1) brands.push(_csr2CarsDb[i].brand)
    }
    brands.sort()
    brandBar.innerHTML = ['All'].concat(brands).map(function(v){
      var active = (v === 'All' && !b) || v === b
      return '<span class="car-filter-chip' + (active?' active':'') + '" onclick="setBrandFilter(\'' + escH(v) + '\')">' + escH(v === 'All' ? 'All Brands' : v) + '</span>'
    }).join('')
  }
}

function setTierFilter(val) {
  _carFilter.tier = (val === 'All' || val === 'null') ? null : +val
  renderCarFilterBar()
  searchCars(document.getElementById('ansb-car-search').value)
}

function setStarFilter(val) {
  _carFilter.starType = (val === 'All') ? null : val
  renderCarFilterBar()
  searchCars(document.getElementById('ansb-car-search').value)
}

function setBrandFilter(val) {
  _carFilter.brand = (val === 'All') ? null : val
  renderCarFilterBar()
  searchCars(document.getElementById('ansb-car-search').value)
}

function toggleAllowDuplicates() {
  _allowDuplicates = document.getElementById('ansb-allow-dup').checked
  searchCars(document.getElementById('ansb-car-search').value)
}

function setCarSectionLocked(locked) {
  var lockMsg = document.getElementById('ansb-car-locked')
  var controls = document.getElementById('ansb-car-controls')
  if (!lockMsg || !controls) return
  lockMsg.style.display = locked ? '' : 'none'
  controls.style.display = locked ? 'none' : ''
}

function handleNsbDrop(e, which) {
  e.preventDefault()
  document.getElementById(which + '-drop').classList.remove('over')
  var file = e.dataTransfer.files[0]
  if (file) readNsbFile(file, which)
}

function handleNsbFile(e, which) {
  var file = e.target.files[0]
  if (file) readNsbFile(file, which)
}

function bufToBase64(buf) {
  var bytes = new Uint8Array(buf), out = '', chunk = 8192
  for (var i = 0; i < bytes.length; i += chunk)
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  return btoa(out)
}

function readNsbFile(file, which) {
  var reader = new FileReader()
  reader.onload = function(e) {
    var base64 = bufToBase64(e.target.result)
    _nsbData[which] = { base64: base64, name: file.name }
    document.getElementById(which + '-file-name').textContent = file.name
    document.getElementById(which + '-file-name').style.display = ''
    if (which === 'ansb') {
      loadNsbComparison()
      document.getElementById('ansb-apply-btn').disabled = false
    } else if (which === 'ensb') {
      loadEnsbCurrent()
    } else {
      document.getElementById('unban-apply-btn').disabled = false
    }
  }
  reader.readAsArrayBuffer(file)
}

async function loadEnsbCurrent() {
  if (!_nsbData.ensb) return
  var res = await fetch('/csr2/read-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ensb.base64 })
  }).then(function(r){ return r.json() }).catch(function(){ return null })
  if (!res || res.error) { showNotice('ensb-notice', 'error', 'Could not read save file.'); return }
  _ensbCurrent = res
  document.getElementById('ensb-form').style.display = ''
  document.getElementById('ensb-apply-btn').disabled = false
  document.getElementById('ensb-unban-btn').disabled = false
  updateEnsbAfter()
}

async function loadNsbComparison() {
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  var pack = _packs.find(function(p){ return p.id === packId })
  if (!pack || !_nsbData.ansb) return
  var res = await fetch('/csr2/read-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ansb.base64 })
  }).then(function(r){ return r.json() }).catch(function(){ return null })
  if (!res || res.error) return
  // Store owned car CRDBs so we can filter them from the search list
  _ownedCrdbs = new Set(Array.isArray(res.ownedCrdbs) ? res.ownedCrdbs : [])
  renderComparison(pack, res)
  setCarSectionLocked(false)
  searchCars(document.getElementById('ansb-car-search').value)
}

function renderComparison(pack, cur) {
  var c = pack.currencies || {}
  var rows = []
  function addRow(lbl, packVal, curVal) {
    if (!packVal) return
    rows.push({ lbl: lbl, delta: '+' + fmtN(packVal), curr: fmtN(curVal), after: fmtN(curVal + packVal) })
  }
  addRow('💵 Cash',        c.cash,       cur.cash       || 0)
  addRow('🪙 Gold',        c.gold,       cur.gold       || 0)
  addRow('🔑 Bronze Keys', c.bronzeKeys, cur.bronzeKeys || 0)
  addRow('🗝️ Silver Keys', c.silverKeys, cur.silverKeys || 0)
  addRow('✨ Gold Keys',   c.goldKeys,   cur.goldKeys   || 0)
  addRow('⛽ Fuel',        c.fuel,       cur.fuel       || 0)
  function addTkRow(color, lbl, packVal, curVal) {
    if (!packVal) return
    rows.push({ lbl: '<span class="token-dot" style="background:' + color + '"></span>' + lbl, delta: '+' + fmtN(packVal), curr: fmtN(curVal), after: fmtN(curVal + packVal), isHtml: true })
  }
  addTkRow('#4caf50', ' Green Tk', c.fusionGreen,  cur.fusionGreen  || 0)
  addTkRow('#2196F3', ' Blue Tk',  c.fusionBlue,   cur.fusionBlue   || 0)
  addTkRow('#e05252', ' Red Tk',   c.fusionRed,    cur.fusionRed    || 0)
  addTkRow('#FFC107', ' Yellow Tk',c.fusionYellow, cur.fusionYellow || 0)
  if (!rows.length) { document.getElementById('ansb-compare').style.display = 'none'; return }
  var html = '<table class="compare-table"><thead><tr>'
  html += '<th>Item</th><th style="text-align:right">Pack</th><th style="text-align:right">Current → After</th>'
  html += '</tr></thead><tbody>'
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]
    var lblHtml = r.isHtml ? r.lbl : escH(r.lbl)
    html += '<tr><td class="comp-label">' + lblHtml + '</td>'
    html += '<td class="comp-delta">' + escH(r.delta) + '</td>'
    html += '<td class="comp-arrow"><span class="comp-curr">' + escH(r.curr) + '</span><span class="comp-arrow-sym">→</span><span class="comp-after">' + escH(r.after) + '</span></td></tr>'
  }
  html += '</tbody></table>'
  document.getElementById('ansb-compare-box').innerHTML = html
  document.getElementById('ansb-compare').style.display = ''
}

function searchCars(query) {
  var results = document.getElementById('ansb-car-results')
  if (!results) return

  if (_csr2CarsDb.length === 0) {
    results.innerHTML = '<div class="car-result-list"><div class="car-result-item" style="color:var(--muted)">Car database empty — click "↺ Car DB" to download.</div></div>'
    return
  }

  var q = query ? query.toLowerCase() : ''
  var matches = []
  for (var i = 0; i < _csr2CarsDb.length && matches.length < 16; i++) {
    var c = _csr2CarsDb[i]
    if (!_allowDuplicates && _ownedCrdbs.has(c.crdb)) continue
    if (_carFilter.tier && c.tier !== _carFilter.tier) continue
    if (_carFilter.brand && c.brand !== _carFilter.brand) continue
    if (_carFilter.starType && c.starType !== _carFilter.starType) continue
    if (q && c.name.toLowerCase().indexOf(q) === -1 && c.brand.toLowerCase().indexOf(q) === -1) continue
    matches.push({ car: c, idx: i })
  }

  if (!matches.length) {
    results.innerHTML = '<div class="car-result-list"><div class="car-result-item" style="color:var(--muted)">No cars found</div></div>'
    return
  }

  var selectedCrdbs = new Set(_selectedCars.map(function(c){ return c.crdb }))
  var starIcon = { Gold: '⭐', Purple: '💜', Legends: '🌟' }
  var html = '<div class="car-result-list">'
  for (var j = 0; j < matches.length; j++) {
    var car = matches[j].car, idx = matches[j].idx
    var added = selectedCrdbs.has(car.crdb)
    var si = starIcon[car.starType] || ''
    html += '<div class="car-result-item">'
    html += '<span class="car-tier-badge">T' + car.tier + '</span>'
    if (si) html += '<span style="font-size:11px">' + si + '</span>'
    html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escH(car.name) + '</span>'
    if (car.colors && car.colors.length > 1) html += '<span style="font-size:10px;color:var(--muted);flex-shrink:0">' + car.colors.length + ' clrs</span>'
    if (added) {
      html += '<span class="car-result-added">Added</span>'
    } else {
      html += '<button class="car-result-add" onclick="addCarToSelection(' + idx + ')">+ Add</button>'
    }
    html += '</div>'
  }
  html += '</div>'
  results.innerHTML = html
}

function addCarToSelection(carIdx) {
  var car = _csr2CarsDb[carIdx]
  if (!car) return
  // If already fully added (all colors selected for single-color car) skip
  if (car.colors && car.colors.length === 1) {
    if (_selectedCars.find(function(c){ return c.crdb === car.crdb && c.colorName === car.colors[0].name })) return
    addCarWithColor(car, car.colors[0])
  } else if (car.colors && car.colors.length > 1) {
    openColorPicker(carIdx)
  } else {
    // No color info (shouldn't happen with real DB)
    if (_selectedCars.find(function(c){ return c.crdb === car.crdb })) return
    _selectedCars.push({ crdb: car.crdb, name: car.name, tier: car.tier, colorName: '', photoUrl: '', stockTxtUrl: '', maxedTxtUrl: null })
    renderSelectedCars()
    searchCars(document.getElementById('ansb-car-search').value)
  }
}

async function addCarWithColor(car, color) {
  if (_selectingColor) return
  _selectingColor = true
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  var pack = _packs.find(function(p){ return p.id === packId })
  var condition = (pack && pack.cars && pack.cars.condition === 'maxed') ? 'maxed' : 'stock'
  var txtUrl = condition === 'maxed' ? (color.maxedTxtUrl || color.stockTxtUrl) : color.stockTxtUrl

  // Show loading indicator on the swatch if color picker is open
  var grid = document.getElementById('cp2-colors-grid')
  if (grid) grid.style.opacity = '0.5'
  showLoading('Loading car data...')

  try {
    if (!txtUrl) throw new Error('No car data URL for this color.')
    var resp = await fetch(txtUrl)
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    var txt = await resp.text()
    JSON.parse(txt)  // validate it's real JSON before adding
    _selectedCars.push({
      crdb: car.crdb,
      name: car.name,
      tier: car.tier,
      colorName: color.name,
      photoUrl: color.photoUrl || '',
      stockTxtUrl: color.stockTxtUrl || '',
      maxedTxtUrl: color.maxedTxtUrl || null,
    })
    hideLoading()
    if (grid) grid.style.opacity = ''
    if (document.getElementById('color-picker-modal').classList.contains('on')) {
      hideModal('color-picker-modal')
    }
    renderSelectedCars()
    searchCars(document.getElementById('ansb-car-search').value)
  } catch (e) {
    hideLoading()
    if (grid) grid.style.opacity = ''
    showNotice('ansb-notice', 'error', 'Failed to load car: ' + e.message)
  }
  _selectingColor = false
}

function removeCarFromSelection(crdb, colorName) {
  _selectedCars = _selectedCars.filter(function(c){ return !(c.crdb === crdb && c.colorName === colorName) })
  renderSelectedCars()
  searchCars(document.getElementById('ansb-car-search').value)
}

function openColorPicker(carIdx) {
  var car = _csr2CarsDb[carIdx]
  if (!car) return
  _colorPickerCar = car
  _colorPickerCarIdx = carIdx
  document.getElementById('cp2-car-name').textContent = car.name
  document.getElementById('cp2-car-sub').textContent = 'T' + car.tier + ' · ' + (car.starType || '') + ' · ' + (car.colors ? car.colors.length : 0) + ' colors'
  hideNotice('cp2-notice')
  var grid = document.getElementById('cp2-colors-grid')
  if (!grid) return
  var selectedKeys = new Set(_selectedCars.map(function(c){ return c.crdb + '|' + c.colorName }))
  var html = ''
  var colors = car.colors || []
  for (var i = 0; i < colors.length; i++) {
    var col = colors[i]
    var alreadySelected = selectedKeys.has(car.crdb + '|' + col.name)
    html += '<div class="color-swatch' + (alreadySelected ? ' loading' : '') + '" onclick="selectColorByIdx(' + carIdx + ',' + i + ')" title="' + escH(col.name) + '">'
    html += '<img src="' + escH(col.photoUrl || '') + '" onerror="this.style.display=\'none\'" loading="lazy">'
    html += '<div class="color-swatch-name">' + escH(col.name) + (alreadySelected ? ' ✓' : '') + '</div>'
    html += '</div>'
  }
  grid.innerHTML = html
  showModal('color-picker-modal')
}

function selectColorByIdx(carIdx, colorIdx) {
  var car = _csr2CarsDb[carIdx]
  if (!car || !car.colors) return
  var color = car.colors[colorIdx]
  if (!color) return
  if (_selectedCars.find(function(c){ return c.crdb === car.crdb && c.colorName === color.name })) {
    showNotice('cp2-notice', 'info', 'This color is already in your selection.')
    return
  }
  addCarWithColor(car, color)
}

function renderSelectedCars() {
  var list = document.getElementById('ansb-selected-cars-list')
  var count = document.getElementById('ansb-selected-count')
  var badge = document.getElementById('ansb-car-count-badge')
  var noteEl = document.getElementById('ansb-cars-remaining-note')
  var n = _selectedCars.length
  if (count) count.textContent = n + ' car' + (n === 1 ? '' : 's') + ' selected'
  if (badge) badge.textContent = '(' + n + ' selected)'
  if (!list) return
  if (!n) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;margin-top:20px">No cars selected.<br>Search and add cars on the left.</div>'
    if (noteEl) noteEl.style.display = 'none'
    return
  }
  var html = ''
  for (var i = 0; i < _selectedCars.length; i++) {
    var car = _selectedCars[i]
    var crdbEsc = escH(car.crdb || '')
    var colEsc = escH(car.colorName || '')
    html += '<div class="selected-car-item">'
    if (car.photoUrl) {
      html += '<img class="selected-car-photo" src="' + escH(car.photoUrl) + '" onerror="this.style.display=\'none\'" loading="lazy">'
    } else {
      html += '<span class="car-tier-badge" style="width:44px;height:30px;display:flex;align-items:center;justify-content:center">T' + car.tier + '</span>'
    }
    html += '<div class="selected-car-info">'
    html += '<div class="scar-name">' + escH(car.name) + '</div>'
    if (car.colorName) html += '<div class="scar-color">' + escH(car.colorName) + '</div>'
    html += '</div>'
    html += '<button class="selected-car-remove" data-crdb="' + crdbEsc + '" data-col="' + colEsc + '" onclick="removeCarFromSelection(this.dataset.crdb,this.dataset.col)" title="Remove">&times;</button>'
    html += '</div>'
  }
  list.innerHTML = html
  if (noteEl) {
    var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
    var pack = _packs.find(function(p){ return p.id === packId })
    var total = pack && pack.cars && pack.cars.count ? pack.cars.count : 0
    if (total > 0) {
      var remaining = Math.max(0, total - n)
      noteEl.style.display = ''
      noteEl.textContent = n + '/' + total + ' selected. ' + (remaining > 0 ? 'Remaining ' + remaining + ' will be filled with cars you don\'t own yet.' : 'All slots filled.')
    } else {
      noteEl.style.display = 'none'
    }
  }
}

async function applyNsb() {
  if (!_nsbData.ansb) return
  var packId = document.getElementById('ansb-pack-select').dataset.forcedId || document.getElementById('ansb-pack-select').value
  showLoading('Applying pack...')
  var payload = { nsbBase64: _nsbData.ansb.base64, packId: packId }
  if (_selectedCars.length > 0) payload.selectedCars = _selectedCars
  var res = await fetch('/csr2/apply-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('ansb-notice', 'error', res.error); return }
  var fname = _nsbData.ansb.name || 'PlayerProfile'
  downloadNsb(res.resultBase64, fname)
  var desc = 'The modified save file has been downloaded.'
  if (res.note) desc += '\n\n' + res.note
  showApplyResult(true, 'Pack Applied!', desc)
  if (_csr2OutputFolder) { saveNsbToFolder(res.resultBase64, fname) }
}

async function applyManualEdit() {
  if (!_nsbData.ensb) return
  showLoading('Applying edits...')
  var additions = {
    cash:       parseInt(document.getElementById('ensb-cash').value)   || 0,
    gold:       parseInt(document.getElementById('ensb-gold').value)   || 0,
    bronzeKeys: parseInt(document.getElementById('ensb-bkeys').value)  || 0,
    silverKeys: parseInt(document.getElementById('ensb-skeys').value)  || 0,
    goldKeys:   parseInt(document.getElementById('ensb-gkeys').value)  || 0,
    fuel:       parseInt(document.getElementById('ensb-fuel').value)   || 0,
    fusionGreen:  parseInt(document.getElementById('ensb-fgreen').value)  || 0,
    fusionBlue:   parseInt(document.getElementById('ensb-fblue').value)   || 0,
    fusionRed:    parseInt(document.getElementById('ensb-fred').value)    || 0,
    fusionYellow: parseInt(document.getElementById('ensb-fyellow').value) || 0,
  }
  var res = await fetch('/csr2/edit-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ensb.base64, additions: additions })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('ensb-notice', 'error', res.error); return }
  var fname = _nsbData.ensb.name || 'PlayerProfile'
  downloadNsb(res.resultBase64, fname)
  showApplyResult(true, 'Edits Applied!', 'The modified save file has been downloaded.')
  if (_csr2OutputFolder) { saveNsbToFolder(res.resultBase64, fname) }
}

function showApplyResult(ok, title, desc) {
  document.getElementById('apply-result-icon').textContent = ok ? '✅' : '❌'
  document.getElementById('apply-result-title').textContent = title
  document.getElementById('apply-result-desc').textContent = desc
  showModal('apply-result-modal')
}

function downloadNsb(b64, filename) {
  var bytes = Uint8Array.from(atob(b64), function(c){ return c.charCodeAt(0) })
  var blob = new Blob([bytes], { type: 'application/octet-stream' })
  var a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

async function saveNsbToFolder(b64, filename) {
  var res = await fetch('/csr2/save-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: b64, filename: filename })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  if (res.conflict) {
    _pendingSavePack = { b64: b64, filename: filename }
    document.getElementById('nsb-conflict-name').textContent = res.existingFile || 'existing file'
    showModal('nsb-conflict-modal')
  }
}

async function confirmSaveToFolder() {
  hideModal('nsb-conflict-modal')
  if (!_pendingSavePack) return
  var p = _pendingSavePack
  _pendingSavePack = null
  await fetch('/csr2/save-nsb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: p.b64, filename: p.filename, forceOverwrite: true })
  }).catch(function(){})
}

function openCsr2Settings() {
  document.getElementById('csr2-folder-input').value = _csr2OutputFolder || ''
  hideNotice('csr2-settings-notice')
  showModal('csr2-settings-modal')
}

async function saveCsr2Settings() {
  var folder = document.getElementById('csr2-folder-input').value.trim()
  _csr2OutputFolder = folder
  var cfg = await fetch('/local/config').then(function(r){ return r.json() }).catch(function(){ return {} })
  cfg.csr2OutputFolder = folder
  await fetch('/local/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) }).catch(function(){})
  showNotice('csr2-settings-notice', 'success', 'Saved!')
  setTimeout(function(){ hideModal('csr2-settings-modal') }, 700)
}

function confirmApplyUnban() {
  hideModal('unban-confirm-modal')
  if (_nsbData.ensb) {
    applyUnbanFromManual()
  } else {
    applyUnban()
  }
}

async function applyUnbanFromManual() {
  if (!_nsbData.ensb) return
  showLoading('Applying unban...')
  var res = await fetch('/csr2/unban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.ensb.base64 })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('ensb-notice', 'error', res.error); return }
  var fname = _nsbData.ensb.name || 'PlayerProfile'
  downloadNsb(res.resultBase64, fname)
  showApplyResult(true, 'Unban Applied!', 'The modified save file has been downloaded. The account has been unbanned.')
}

function updateEnsbAfter() {
  var fields = [
    { key:'cash',   cur:_ensbCurrent.cash||0,   id:'ensb-cash'   },
    { key:'gold',   cur:_ensbCurrent.gold||0,   id:'ensb-gold'   },
    { key:'bronzeKeys',cur:_ensbCurrent.bronzeKeys||0,id:'ensb-bkeys'},
    { key:'silverKeys',cur:_ensbCurrent.silverKeys||0,id:'ensb-skeys'},
    { key:'goldKeys',  cur:_ensbCurrent.goldKeys||0,  id:'ensb-gkeys'},
    { key:'fuel',   cur:_ensbCurrent.fuel||0,   id:'ensb-fuel'   },
    { key:'fusionGreen', cur:_ensbCurrent.fusionGreen||0,  id:'ensb-fgreen'},
    { key:'fusionBlue',  cur:_ensbCurrent.fusionBlue||0,   id:'ensb-fblue' },
    { key:'fusionRed',   cur:_ensbCurrent.fusionRed||0,    id:'ensb-fred'  },
    { key:'fusionYellow',cur:_ensbCurrent.fusionYellow||0, id:'ensb-fyellow'},
  ]
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i]
    var add = parseInt(document.getElementById(f.id) ? document.getElementById(f.id).value : '0') || 0
    var af = document.getElementById(f.id + '-after')
    if (af) af.textContent = add > 0 ? fmtN(f.cur + add) : '—'
  }
}

function toggleVersionSection() {
  var on = document.getElementById('cp-ver-toggle').checked
  document.getElementById('cp-ver-section').style.display = on ? '' : 'none'
}

// ─── Unban Modal ──────────────────────────────────────────────────────────────

function openUnban() {
  _nsbData.unban = null
  document.getElementById('unban-file-name').style.display = 'none'
  document.getElementById('unban-apply-btn').disabled = true
  document.getElementById('unban-drop').classList.remove('over')
  hideNotice('unban-notice')
  showModal('unban-modal')
}

async function applyUnban() {
  if (!_nsbData.unban) return
  showLoading('Applying unban...')
  var res = await fetch('/csr2/unban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nsbBase64: _nsbData.unban.base64 })
  }).then(function(r){ return r.json() }).catch(function(e){ return { error: e.message } })
  hideLoading()
  if (res.error) { showNotice('unban-notice', 'error', res.error); return }
  downloadNsb(res.resultBase64, _nsbData.unban.name || 'PlayerProfile')
  hideModal('unban-modal')
  showApplyResult(true, 'Unban Applied!', 'The account has been unbanned. The modified save file has been downloaded.')
}

// ─── Loading + Download utils ─────────────────────────────────────────────────

function showLoading(msg) {
  document.getElementById('loading-msg').textContent = msg || 'Processing...'
  document.getElementById('loading-overlay').classList.add('on')
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.remove('on')
}

function downloadBase64(b64, filename) {
  var bytes = Uint8Array.from(atob(b64), function(c){ return c.charCodeAt(0) })
  var blob = new Blob([bytes])
  var a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

init()
// Heartbeat: immediate on load, then every 5s — keeps server alive while window is open
function sendHeartbeat() { fetch('/heartbeat', { method: 'POST' }).catch(function(){}) }
sendHeartbeat()
setInterval(sendHeartbeat, 5000)
// Signal server to shut down when window closes (5s grace so refresh can cancel it)
window.addEventListener('beforeunload', function() { navigator.sendBeacon('/shutdown', '{}') })
