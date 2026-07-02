import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ckisdighdsaspnjyvlsn.supabase.co'

export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_KEY || '',
)
