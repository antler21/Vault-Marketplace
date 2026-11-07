// "Unreleased" car flagging for the buyer-facing car picker (spec section 9).
// Mirrors the GitHub-commits-API "update available" pattern already used by
// app/api/nsb/update-check/route.js, applied to 1.Cars' own "Update x.x.x" staging
// folders instead of the ##All*.txt index files.
const REPO = 'Nitro4CSR/CSR2-DataBase'
const BRANCH = 'Everything'
const UNRELEASED_WINDOW_DAYS = 7

async function ghApi(path) {
  const res = await fetch('https://api.github.com' + path, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vault-admin' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('GitHub API ' + res.status)
  return res.json()
}

// Commit search needs sha=Everything explicitly — without it GitHub searches the
// repo's default branch, which doesn't have these "Update x.x.x" staging folders.
async function latestCommitDate(path) {
  const commits = await ghApi('/repos/' + REPO + '/commits?path=' + encodeURIComponent(path) + '&sha=' + BRANCH + '&per_page=1')
  return commits?.[0]?.commit?.committer?.date ? new Date(commits[0].commit.committer.date) : null
}

// Returns the set of "brand|model" keys currently staged under any 1.Cars/Update x.x.x
// folder whose last commit is within the unreleased window, plus per-folder metadata.
export async function getUnreleasedCars() {
  const rootTree = await ghApi('/repos/' + REPO + '/git/trees/' + BRANCH)
  const carsEntry = (rootTree.tree || []).find(e => e.path === '1.Cars' && e.type === 'tree')
  if (!carsEntry) return { unreleased: new Set(), folders: [] }

  const carsTree = await ghApi('/repos/' + REPO + '/git/trees/' + carsEntry.sha)
  const updateFolders = (carsTree.tree || []).filter(e => e.type === 'tree' && /^Update [\d.]+$/.test(e.path))

  const unreleased = new Set()
  const folders = []
  const now = Date.now()

  for (const folder of updateFolders) {
    const lastCommit = await latestCommitDate('1.Cars/' + folder.path)
    const isRecent = !!lastCommit && (now - lastCommit.getTime()) < UNRELEASED_WINDOW_DAYS * 24 * 60 * 60 * 1000
    folders.push({ name: folder.path, lastCommit, isRecent })
    if (!isRecent) continue

    const folderTree = await ghApi('/repos/' + REPO + '/git/trees/' + folder.sha + '?recursive=1')
    for (const item of folderTree.tree || []) {
      if (item.type !== 'blob' || !item.path.endsWith('.txt')) continue
      // <star>/<brand>/<model>/<color>.txt under either 1.Stock or 2.Maxed
      const parts = item.path.split('/')
      if (parts.length < 4) continue
      const brand = parts[parts.length - 3]
      const model = parts[parts.length - 2]
      unreleased.add(brand + '|' + model)
    }
  }

  return { unreleased, folders }
}
