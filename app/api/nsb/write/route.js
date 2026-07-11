import { parseSave, writeSave } from '@/lib/csr2Save'
import { supabase } from '../../../lib/supabase'

export const runtime = 'nodejs'

const FUSIONS_URL  = 'https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/3.Fusions/%23%23AllFusions.txt'
const STAGE6_URL   = "https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/4.Stage6's/%23%23AllStage6's.txt"

async function ghFetch(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('GitHub fetch failed (' + res.status + '): ' + url)
  return res.text()
}

async function getCachedOrGhJson(cacheKey, ghUrl) {
  try {
    const { data: row } = await supabase.from('csr2_cache').select('data').eq('key', cacheKey).single()
    if (Array.isArray(row?.data) && row.data.length > 0) return row.data
  } catch {}
  const txt = await ghFetch(ghUrl)
  return JSON.parse(txt)
}

export async function POST(request) {
  try {
    const body = await request.json()
    if (!body.nsbBase64) return Response.json({ error: 'Missing nsbBase64' }, { status: 400 })

    const buf = Buffer.from(body.nsbBase64, 'base64')
    const data = parseSave(buf)

    // ── Currency ───────────────────────────────────────────────────────────────
    const c = body.currency || {}
    if ('cash'        in c) data.caea = (data.casp || 0) + Math.max(0, Number(c.cash) || 0)
    if ('gold'        in c) data.goea = (data.gosp || 0) + Math.max(0, Number(c.gold) || 0)
    if ('bronzeKeys'  in c) data.gbke = (data.gbks || 0) + Math.max(0, Number(c.bronzeKeys) || 0)
    if ('silverKeys'  in c) data.gske = (data.gsks || 0) + Math.max(0, Number(c.silverKeys) || 0)
    if ('goldKeys'    in c) data.ggke = (data.ggks || 0) + Math.max(0, Number(c.goldKeys) || 0)
    if ('fuel'        in c) data.fupi = Math.max(0, Number(c.fuel) || 0)
    if (!data.afme) data.afme = {}
    if ('fusionGreen'  in c) data.afme.Green  = Math.max(0, Number(c.fusionGreen) || 0)
    if ('fusionBlue'   in c) data.afme.Blue   = Math.max(0, Number(c.fusionBlue) || 0)
    if ('fusionRed'    in c) data.afme.Red    = Math.max(0, Number(c.fusionRed) || 0)
    if ('fusionYellow' in c) data.afme.Yellow = Math.max(0, Number(c.fusionYellow) || 0)

    // ── Legends ────────────────────────────────────────────────────────────────
    if (body.legends && typeof body.legends === 'object') {
      if (!data.icnd) data.icnd = {}
      data.icnd.crpe = {}
      for (const [crdb, amount] of Object.entries(body.legends)) {
        const v = Math.max(0, parseInt(amount) || 0)
        if (v > 0) data.icnd.crpe[crdb] = v
      }
    }

    // ── Fusions ────────────────────────────────────────────────────────────────
    let fusionData = null
    if (body.fusionsAll != null) {
      fusionData = await getCachedOrGhJson('fusions_full', FUSIONS_URL)
      if (Array.isArray(fusionData) && fusionData.length > 0) {
        const amt = Math.max(0, parseInt(body.fusionsAll) || 0)
        data.caup = fusionData.map(e => {
          if (typeof e === 'object' && e !== null) { const c2 = Object.assign({}, e); if ('upnn' in c2) c2.upnn = amt; return c2 }
          return typeof e === 'number' ? amt : e
        })
      }
    } else if (body.fusions && typeof body.fusions === 'object') {
      if (!data.caup) data.caup = []
      fusionData = await getCachedOrGhJson('fusions_full', FUSIONS_URL)
      for (const [upma, amount] of Object.entries(body.fusions)) {
        const amt = Math.max(0, parseInt(amount) || 0)
        let found = false
        for (let i = 0; i < data.caup.length; i++) {
          const e = data.caup[i]
          if (typeof e === 'object' && e !== null && e.upma === upma) {
            if ('upnn' in e) e.upnn = amt
            if (i + 1 < data.caup.length && typeof data.caup[i + 1] === 'number') data.caup[i + 1] = amt
            found = true
          }
        }
        if (!found && amt > 0 && Array.isArray(fusionData)) {
          for (let i = 0; i < fusionData.length; i++) {
            const e = fusionData[i]
            if (typeof e === 'object' && e !== null && e.upma === upma) {
              const entry = Object.assign({}, e); if ('upnn' in entry) entry.upnn = amt
              data.caup.push(entry)
              const next = fusionData[i + 1]
              data.caup.push(typeof next === 'number' ? amt : amt)
              i++
            }
          }
        }
      }
    }

    // ── Stage 6 ────────────────────────────────────────────────────────────────
    let s6CarCache = null
    async function getS6Car(esdb) {
      if (!s6CarCache) {
        try {
          const { data: row } = await supabase.from('csr2_cache').select('data').eq('key', 's6_car_list').single()
          s6CarCache = row?.data || []
        } catch { s6CarCache = [] }
      }
      return s6CarCache.find(c => c.esdb === esdb) || null
    }
    if (body.s6All != null) {
      const stage6Data = await getCachedOrGhJson('stage6_full', STAGE6_URL)
      if (Array.isArray(stage6Data) && stage6Data.length > 0) {
        const amt = Math.max(0, parseInt(body.s6All) || 0)
        data.cues = stage6Data.map(e => {
          if (typeof e === 'object' && e !== null) return Object.assign({}, e, { esnn: amt })
          return typeof e === 'number' ? amt : e
        })
      }
    } else if (body.stage6 && typeof body.stage6 === 'object') {
      if (!data.cues) data.cues = []
      for (const [esdb, amount] of Object.entries(body.stage6)) {
        const amt = Math.max(0, parseInt(amount) || 0)
        let found = false
        for (let i = 0; i < data.cues.length; i++) {
          const e = data.cues[i]
          if (typeof e === 'object' && e !== null && e.esdb === esdb) { found = true; break }
        }
        if (!found && amt > 0) {
          const car = await getS6Car(esdb)
          if (car?.filePath) {
            try {
              const encoded = car.filePath.split('/').map(s => encodeURIComponent(s)).join('/')
              let txt = await ghFetch('https://raw.githubusercontent.com/Nitro4CSR/CSR2-DataBase/Everything/' + encoded)
              txt = txt.replace(/\bAMOUNT\b/g, String(amt)).trim()
              if (txt.startsWith(',')) txt = txt.slice(1).trim()
              if (txt.endsWith(',')) txt = txt.slice(0, -1)
              const arr = JSON.parse('[' + txt + ']')
              for (const e of arr) {
                data.cues.push(typeof e === 'object' && e !== null ? Object.assign({}, e) : e)
              }
            } catch {}
          }
        }
        if (found && amt === 0) {
          const newCues = []
          for (let i = 0; i < data.cues.length; i++) {
            const e = data.cues[i]
            if (typeof e === 'object' && e !== null && e.esdb === esdb) { i++ }
            else { newCues.push(e) }
          }
          data.cues = newCues
        } else if (found && amt > 0) {
          for (let i = 0; i < data.cues.length; i++) {
            const e = data.cues[i]
            if (typeof e === 'object' && e !== null && e.esdb === esdb) {
              e.esnn = amt
              if (i + 1 < data.cues.length && typeof data.cues[i + 1] === 'number') data.cues[i + 1] = amt
            }
          }
        }
      }
    }

    // ── Save Version ───────────────────────────────────────────────────────────
    if (body.setPrvr != null) {
      const v = String(body.setPrvr)
      data.prvr = v
      if ('prvrfi' in data) data.prvrfi = v
      if ('adbpvr' in data) data.adbpvr = v
    }

    // ── Garage delete ──────────────────────────────────────────────────────────
    if (Array.isArray(body.garageDeleted) && body.garageDeleted.length > 0 && Array.isArray(data.caow)) {
      const toDelete = new Set(body.garageDeleted.map(d => d.unid))
      data.caow = data.caow.filter(car => !toDelete.has(car.unid))
      data.cgpi = [...Array(data.caow.length).keys(), -1]
    }

    // ── Garage add ─────────────────────────────────────────────────────────────
    if (Array.isArray(body.garageAdded) && body.garageAdded.length > 0) {
      if (!data.caow) data.caow = []
      const template = data.caow.length > 0 ? data.caow[0] : null
      for (const item of body.garageAdded) {
        const crdb = typeof item === 'string' ? item : (item.esdb || item.crdb)
        const paid = typeof item === 'object' && item.paid != null ? item.paid : undefined
        const unid = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
        if (template) {
          const clone = JSON.parse(JSON.stringify(template))
          clone.crdb = crdb
          clone.unid = unid
          if (paid !== undefined) clone.paid = paid
          data.caow.push(clone)
        } else {
          data.caow.push({ crdb, unid, ...(paid !== undefined ? { paid } : {}) })
        }
      }
      data.cgpi = [...Array(data.caow.length).keys(), -1]
    }

    const out = writeSave(data)
    return new Response(new Uint8Array(out), {
      headers: { 'Content-Type': 'application/octet-stream' },
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
