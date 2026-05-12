const API_KEY = 'f728260d52cf51f35d7df883'

let ratesCache = null
let lastFetched = null

export async function getExchangeRates(base = 'USD') {
  const now = Date.now()
  if (ratesCache && lastFetched && (now - lastFetched) < 1000 * 60 * 60) {
    return ratesCache
  }

  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${base}`)
    const data = await res.json()
    if (data.result === 'success') {
      ratesCache = data.conversion_rates
      lastFetched = now
      return ratesCache
    }
  } catch (err) {
    console.error('Failed to fetch exchange rates:', err)
  }
  return null
}

export function convertAmount(amount, fromCurrency, toCurrency, rates) {
  if (!rates || !amount) return amount
  if (fromCurrency === toCurrency) return amount

  const fromRate = rates[fromCurrency]
  const toRate = rates[toCurrency]
  if (!fromRate || !toRate) return amount

  const inBase = amount / fromRate
  return inBase * toRate
}

export function formatAmount(amount, currency) {
  return `${currency}${Number(amount).toFixed(2)}`
}