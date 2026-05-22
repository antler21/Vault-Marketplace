// CSR2 save file editor
// Save format: gzip( sha1_hex_of_json + "\n" + json_string )
// Line 1: SHA1 hash of the JSON string on line 2
// Line 2: JSON data
// Any edit requires recalculating the SHA1 or the game rejects the save.

const fs = require('fs')
const zlib = require('zlib')
const crypto = require('crypto')

function sha1(str) {
  return crypto.createHash('sha1').update(str, 'utf8').digest('hex')
}

function readSave(filePath) {
  const compressed = fs.readFileSync(filePath)
  const raw = zlib.gunzipSync(compressed).toString('utf8')
  const newlineIdx = raw.indexOf('\n')
  const storedHash = raw.slice(0, newlineIdx).trim()
  const jsonStr = raw.slice(newlineIdx + 1)
  const actualHash = sha1(jsonStr)
  if (storedHash !== actualHash) {
    throw new Error(`Save file hash mismatch: stored=${storedHash} actual=${actualHash}`)
  }
  return JSON.parse(jsonStr)
}

function writeSave(filePath, data) {
  const jsonStr = JSON.stringify(data)
  const hash = sha1(jsonStr)
  const raw = hash + '\n' + jsonStr
  const compressed = zlib.gzipSync(Buffer.from(raw, 'utf8'))
  fs.writeFileSync(filePath, compressed)
}

// currencies: object with any subset of keys:
// cash, gold, bronzeKeys, silverKeys, goldKeys, fuel, playerLevel, playerXp, afme
function editCurrencies(data, currencies) {
  if ('cash'        in currencies) data.caea = currencies.cash
  if ('gold'        in currencies) data.goea = currencies.gold
  if ('bronzeKeys'  in currencies) data.gbke = currencies.bronzeKeys
  if ('silverKeys'  in currencies) data.gske = currencies.silverKeys
  if ('goldKeys'    in currencies) data.ggke = currencies.goldKeys
  if ('fuel'        in currencies) data.fupi = currencies.fuel
  if ('playerLevel' in currencies) data.pllv = currencies.playerLevel
  if ('playerXp'    in currencies) data.plrp = currencies.playerXp
  if ('afme'        in currencies) data.afme = currencies.afme
}

// carJson: full car object from GitHub DB (must include crdb at minimum)
// Sets unid to current ncui value, then increments ncui
function addCar(data, carJson) {
  const unid = data.ncui
  const car = { ...carJson, unid }
  if (!Array.isArray(data.caow)) data.caow = []
  data.caow.push(car)
  data.ncui = unid + 1
  return unid
}

// crdb: car database identifier string (e.g. "id_porsche_911_gt3_rs_2019")
// githubCarData: { msou, nuub, esup, upst, ... } from GitHub car DB
// Only updates the upgrade/performance fields — leaves unid, tuning, etc. intact
function maxCar(data, crdb, githubCarData) {
  if (!Array.isArray(data.caow)) throw new Error('caow not found in save')
  const car = data.caow.find(c => c.crdb === crdb)
  if (!car) throw new Error(`Car not found in garage: ${crdb}`)
  if (githubCarData.msou !== undefined) car.msou = githubCarData.msou
  if (githubCarData.nuub !== undefined) car.nuub = githubCarData.nuub
  if (githubCarData.esup !== undefined) car.esup = githubCarData.esup
  if (githubCarData.upst !== undefined) car.upst = githubCarData.upst
  return car
}

function removeCar(data, crdb) {
  if (!Array.isArray(data.caow)) throw new Error('caow not found in save')
  const idx = data.caow.findIndex(c => c.crdb === crdb)
  if (idx === -1) throw new Error(`Car not found in garage: ${crdb}`)
  data.caow.splice(idx, 1)
}

// esut: 'TURBO' | 'INTAKE' | 'TYRES' | 'ENGINE' | 'TRANSMISSION' | 'NITROUS' | 'BODY'
// esdb: car crdb identifier
// qty: number of stage 6 upgrades to add (default 1)
function addStage6(data, esut, esdb, qty = 1) {
  if (!Array.isArray(data.cues)) data.cues = []
  // Some entries have esnn:1 for engine, include it when needed
  const entry = esut === 'ENGINE'
    ? { esnn: 1, esut, esdb }
    : { esut, esdb }
  data.cues.push(entry, qty)
}

// tokens: object keyed by car name (e.g. { "Ferrari_250GTOClassic_1962": 20250 })
// Writes to icnd.crpe — NOT root crpe (root crpe has timestamp keys, don't touch)
function setLegendTokens(data, tokens) {
  if (!data.icnd) data.icnd = {}
  if (!data.icnd.crpe) data.icnd.crpe = {}
  Object.assign(data.icnd.crpe, tokens)
}

// fusion: { upma, upnn, upcu: { adid, upty, uplv, gstd } }
// qty: how many fusions to apply
function addFusion(data, fusion, qty = 1) {
  if (!Array.isArray(data.caup)) data.caup = []
  data.caup.push({ ...fusion }, qty)
}

module.exports = { readSave, writeSave, editCurrencies, addCar, maxCar, removeCar, addStage6, setLegendTokens, addFusion }
