import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ckisdighdsaspnjyvlsn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNraXNkaWdoZHNhc3Buanl2bHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjMwNjYsImV4cCI6MjA5MTQ5OTA2Nn0.CwoBaPyLdJ3tZzp3ycDuJtSfWww6EUcUlOcouraSIYM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)