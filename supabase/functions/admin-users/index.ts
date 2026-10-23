// Edge Function: gerir os acessos da família (nome de utilizador + código de 6 dígitos).
// Ações: bootstrap (cria o primeiro admin, só quando ainda não há ninguém), create e reset (só admins).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const emailOf = (u: string) => `${u.trim().toLowerCase()}@treinoemcasa.local`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const body = await req.json()
    const { action } = body as { action: string }

    const validCode = (c: string) => /^\d{6}$/.test(c ?? '')
    const validUser = (u: string) => /^[a-z0-9._-]{2,20}$/.test(u ?? '')

    async function createMember(m: { username: string; display_name: string; code: string; avatar?: string; color?: string; role?: string; min_days_week?: number }, actor: string | null) {
      if (!validUser(m.username)) return json({ error: 'Nome de utilizador inválido.' }, 400)
      if (!validCode(m.code)) return json({ error: 'O código tem de ter 6 dígitos.' }, 400)
      const { data: exists } = await admin.from('profiles').select('id').eq('username', m.username).maybeSingle()
      if (exists) return json({ error: 'Esse nome de utilizador já existe.' }, 400)
      const created = await admin.auth.admin.createUser({ email: emailOf(m.username), password: m.code, email_confirm: true })
      if (created.error) return json({ error: created.error.message }, 400)
      const id = created.data.user.id
      const ins = await admin.from('profiles').insert({
        id, username: m.username, display_name: m.display_name || m.username, avatar: m.avatar ?? '', color: m.color ?? '#39C2EF',
        role: m.role === 'admin' ? 'admin' : 'member', min_days_week: m.min_days_week ?? 2,
      })
      if (ins.error) {
        await admin.auth.admin.deleteUser(id)
        return json({ error: ins.error.message }, 400)
      }
      await admin.from('audit_log').insert({ actor_id: actor ?? id, action: 'profile.create', entity: 'profile', entity_id: id, detail: m.display_name })
      return json({ id })
    }

    if (action === 'bootstrap') {
      const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
      if ((count ?? 0) > 0) return json({ error: 'A família já está configurada.' }, 403)
      return await createMember({ ...body, role: 'admin' }, null)
    }

    // as outras ações precisam de um admin com sessão
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: who } = await admin.auth.getUser(token)
    if (!who?.user) return json({ error: 'Sessão inválida.' }, 401)
    const { data: me } = await admin.from('profiles').select('role, active').eq('id', who.user.id).maybeSingle()
    if (!me || me.role !== 'admin' || !me.active) return json({ error: 'Só um admin pode fazer isto.' }, 403)

    if (action === 'create') return await createMember(body, who.user.id)

    if (action === 'reset') {
      if (!validCode(body.code)) return json({ error: 'O código tem de ter 6 dígitos.' }, 400)
      const r = await admin.auth.admin.updateUserById(body.id, { password: body.code })
      if (r.error) return json({ error: r.error.message }, 400)
      await admin.from('audit_log').insert({ actor_id: who.user.id, action: 'profile.reset_code', entity: 'profile', entity_id: body.id, detail: 'Código novo gerado' })
      return json({ ok: true })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
