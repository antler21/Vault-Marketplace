import { parseSave } from '@/lib/csr2Save'

export const runtime = 'nodejs'

const LEGEND_CARS = [
  { crdb: 'Ferrari_250GTOClassic_1962',            name: 'Ferrari 250 GTO',                maxAmount: 14800 },
  { crdb: 'AstonMartin_DB5Classic_1964',            name: 'Aston Martin DB5',               maxAmount: 17400 },
  { crdb: 'MercedesBenz_300SLClassic_1954',         name: 'Mercedes-Benz 300SL',            maxAmount: 17400 },
  { crdb: 'Shelby_Cobra427SCClassic_1965',          name: 'Shelby Cobra',                   maxAmount: 25800 },
  { crdb: 'Chevrolet_CorvetteZR1Classic_1970',      name: 'Chevy Corvette C3',              maxAmount: 25800 },
  { crdb: 'Pontiac_GTOTheJudgeClassic_1969',        name: 'Pontiac GTO',                    maxAmount: 29600 },
  { crdb: 'Honda_NSXRClassic_1992',                 name: 'Honda NSX-R',                    maxAmount: 36000 },
  { crdb: 'Plymouth_HemiCudaClassic_1971',          name: 'Plymouth Hemi Cuda',             maxAmount: 38200 },
  { crdb: 'Ford_GT40MkII_1966',                     name: 'Ford GT40',                      maxAmount: 40400 },
  { crdb: 'Lamborghini_CountachClassic_1988',       name: 'Lamborghini Countach',           maxAmount: 40400 },
  { crdb: 'Porsche_CarreraGTClassic_2003',          name: 'Porsche Carrera GT',             maxAmount: 50000 },
  { crdb: 'Lamborghini_MiuraSVLPClassic_1971',      name: 'Lamborghini Miura SVL',          maxAmount: 50000 },
  { crdb: 'Bugatti_EB110SSClassic_1992',            name: 'Bugatti EB110',                  maxAmount: 50000 },
  { crdb: 'Jaguar_XJ220Classic_1993',               name: 'Jaguar XJ220',                   maxAmount: 53400 },
  { crdb: 'Ford_MustangShelbyGT350LPClassic_1965',  name: 'Ford Mustang Shelby GT350LP',    maxAmount: 56000 },
  { crdb: 'Saleen_S7Classic_2004',                  name: 'Saleen S7',                      maxAmount: 56400 },
  { crdb: 'Plymouth_SuperbirdLPClassic_1970',       name: 'Plymouth Superbird LP',          maxAmount: 65000 },
  { crdb: 'Porsche_911CarreraRS27LPClassic_1973',   name: 'Porsche 911 Carrera RS27 LP',    maxAmount: 65000 },
  { crdb: 'Datsun_240ZLPClassic_1972',              name: 'Datsun 240Z LP',                 maxAmount: 65000 },
  { crdb: 'Dodge_ChallengerRTLPClassic_1970',       name: 'Dodge Challenger R/T Classic',   maxAmount: 64000 },
  { crdb: 'Chevrolet_CorvetteC1LPClassic_1958',     name: 'Chevrolet Corvette C1',          maxAmount: 70000 },
  { crdb: 'Chevrolet_NovaSSLPClassic_1970',         name: 'Chevy Nova SS Classic',          maxAmount: 70000 },
  { crdb: 'Ford_EscortMk1RS2000LPClassic_1973',     name: 'Ford Escort Mk1 RS2000 Classic', maxAmount: 70000 },
  { crdb: 'Dodge_ViperSR1LPClassic_1995',           name: 'Dodge Viper SR1 LP',             maxAmount: 75000 },
  { crdb: 'Ford_MustangSVTCobraRLPClassic_1993',    name: 'Ford Mustang SVT Cobra R',       maxAmount: 75000 },
  { crdb: 'Porsche_911Turbo930LPClassic_1977',      name: 'Porsche 911 Turbo (930)',        maxAmount: 75000 },
]

function findBestCrpe(obj, depth) {
  if (depth <= 0 || typeof obj !== 'object' || obj === null || Array.isArray(obj)) return { score: 0, data: {} }
  const lcCrdbs = new Set(LEGEND_CARS.map(lc => lc.crdb))
  let best = { score: 0, data: {} }
  for (const k of Object.keys(obj)) {
    if (k === 'crpe' && typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      let cnt = 0; for (const ck in obj[k]) { if (lcCrdbs.has(ck)) cnt++ }
      if (cnt > best.score) best = { score: cnt, data: obj[k] }
    }
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      const sub = findBestCrpe(obj[k], depth - 1)
      if (sub.score > best.score) best = sub
    }
  }
  return best
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    const data = parseSave(buf)

    const currencies = {
      cash:         Math.max(0, (data.caea || 0) - (data.casp || 0)),
      gold:         Math.max(0, (data.goea || 0) - (data.gosp || 0)),
      bronzeKeys:   Math.max(0, (data.gbke || 0) - (data.gbks || 0)),
      silverKeys:   Math.max(0, (data.gske || 0) - (data.gsks || 0)),
      goldKeys:     Math.max(0, (data.ggke || 0) - (data.ggks || 0)),
      fuel:         data.fupi || 0,
      fusionGreen:  (data.afme && data.afme.Green)  || 0,
      fusionBlue:   (data.afme && data.afme.Blue)   || 0,
      fusionRed:    (data.afme && data.afme.Red)    || 0,
      fusionYellow: (data.afme && data.afme.Yellow) || 0,
    }

    const ownedCars = Array.isArray(data.caow)
      ? data.caow.filter(c => c && c.crdb).map(c => ({ crdb: c.crdb, unid: c.unid, name: c.crdb }))
      : []

    const crpe = findBestCrpe(data, 5).data
    const lcMap = LEGEND_CARS.reduce((m, lc) => { m[lc.crdb] = lc; return m }, {})
    const legendsOwned = []
    for (const [crdb, amount] of Object.entries(crpe)) {
      const lc = lcMap[crdb]; if (lc) legendsOwned.push({ crdb, name: lc.name, amount, maxAmount: lc.maxAmount })
    }
    const legendsAvailable = LEGEND_CARS.filter(lc => !(lc.crdb in crpe))

    const fusionOwnedMap = new Map()
    for (let i = 0; i < (data.caup || []).length; i++) {
      const e = data.caup[i]
      if (typeof e === 'object' && e !== null && e.upma && !fusionOwnedMap.has(e.upma)) {
        const next = data.caup[i + 1]
        fusionOwnedMap.set(e.upma, typeof next === 'number' ? next : 0)
      }
    }
    const fusionOwned = Array.from(fusionOwnedMap.entries()).map(([upma, amount]) => ({ upma, amount }))

    const s6OwnedMap = new Map()
    for (let i = 0; i < (data.cues || []).length; i++) {
      const e = data.cues[i]
      if (typeof e === 'object' && e !== null && e.esdb) {
        const next = data.cues[i + 1]
        if (typeof next === 'number') s6OwnedMap.set(e.esdb, next)
      }
    }
    const s6Owned = Array.from(s6OwnedMap.entries()).map(([esdb, amount]) => ({ esdb, amount }))

    return Response.json({
      currencies,
      playerName: data.name || data.pnam || data.prfn || '',
      prvr: data.prvr || '',
      garage: { carCount: ownedCars.length, ownedCars },
      legends: { owned: legendsOwned, available: legendsAvailable },
      fusions: { owned: fusionOwned },
      stage6: { owned: s6Owned },
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
