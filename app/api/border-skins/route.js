import { supabase } from '../../lib/supabase'

const DEFAULT_DISCLAIMER = 'Border detection is ~95% accurate — some skins may have a border but not be marked.'

export async function GET() {
  const { data } = await supabase
    .from('game_section_configs')
    .select('config')
    .eq('section', 'checker_categories')

  const skinIds = []
  let disclaimerEnabled = true
  let disclaimerMsg = ''

  if (Array.isArray(data)) {
    for (const row of data) {
      const ids = row?.config?.border_skin_ids
      if (Array.isArray(ids)) skinIds.push(...ids)
      if (row?.config?.disclaimer_enabled !== undefined) disclaimerEnabled = row.config.disclaimer_enabled
      if (row?.config?.disclaimer_msg !== undefined) disclaimerMsg = row.config.disclaimer_msg
    }
  }

  return Response.json({
    skin_ids: [...new Set(skinIds)],
    disclaimer_enabled: disclaimerEnabled,
    disclaimer_msg: disclaimerMsg || DEFAULT_DISCLAIMER,
  })
}
