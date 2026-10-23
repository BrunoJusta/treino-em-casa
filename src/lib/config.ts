import { demoApi } from '../data/demoApi'
import { createSupabaseApi } from '../data/supabaseApi'
import type { DataApi } from '../data/api'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const api: DataApi = url && key ? createSupabaseApi(url, key) : demoApi
export const isDemo = api.mode === 'demo'
