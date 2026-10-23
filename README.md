# Treino em Casa

PWA para a família treinar no ginásio lá de baixo. Cada pessoa marca os dias do mês, regista o treino com uma foto, e falhar dois dias seguidos põe 5 € no jarro. Com XP, níveis, conquistas, ranking, feed, player de treino com voz e um backoffice para o admin.

- Regras e decisões: [DECISOES.md](DECISOES.md)
- Brief do produto: [BRIEF.md](BRIEF.md)

## Correr no computador

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes das regras do jarro, do planeamento e dos ícones
npm run build      # build de produção em dist/
```

Sem o ficheiro `.env`, a app arranca em **modo demo**: tudo fica guardado no próprio browser, com 5 pessoas de exemplo (código `123456` para todos). Serve para experimentar os ecrãs antes de ligar o Supabase. No ecrã de entrada há um botão para repor os dados de demonstração.

## Ligar ao Supabase

### 1. Variáveis de ambiente

Copia `.env.example` para `.env` e preenche com os dados do projeto (Supabase > Project Settings > API):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

A service role key **nunca** vai para o `.env` da app. Só é usada pela Edge Function, onde o Supabase a injeta sozinho.

### 2. Base de dados, Storage e cron

Com a CLI do Supabase (não precisa de instalar nada, corre com `npx`):

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Isto corre as três migrações de `supabase/migrations`:

1. `..._schema.sql`: tabelas, RLS e proteções (triggers).
2. `..._logic.sql`: desculpas, jarro, fecho do mês, preenchimento automático, buckets `photos` (privado) e `avatars` (público), e o agendamento de hora a hora com `pg_cron`.
3. `..._seed.sql`: material da casa e os 4 planos da família.

Se o `db push` se queixar do `pg_cron`, ativa-o em Database > Extensions (ou Integrations > Cron) e corre outra vez.

### 3. Edge Function dos acessos

```bash
npx supabase functions deploy admin-users --no-verify-jwt
```

Cria pessoas (nome de utilizador + código), gera códigos novos e cria o primeiro admin.

### 4. Definições de Auth (no painel do Supabase)

- Authentication > Providers > Email: **ligado**. Os emails são internos (`nome@treinoemcasa.local`) e ninguém os vê.
- Authentication > Sign In / Providers: **desliga "Allow new users to sign up"**. As contas só são criadas pelo admin, através da Edge Function.
- A password mínima tem de ser 6 (é o valor por omissão), porque o código tem 6 dígitos.

### 5. Primeira entrada

Abre a app. Como ainda não há ninguém, aparece o ecrã **Primeira vez**: cria a tua conta de admin (por exemplo `bruno` e um código de 6 dígitos). Depois, em Backoffice > Pessoas, junta o resto da família. Cada código aparece uma vez para o dares à pessoa.

## Deploy na Vercel

1. Importa o repositório `BrunoJusta/treino-em-casa` na Vercel (framework: Vite).
2. Em Settings > Environment Variables, junta `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Deploy. O `vercel.json` já trata das rotas da SPA.

No iPhone: abre o link no Safari > Partilhar > Adicionar ao ecrã principal. No Android: Chrome > Instalar app.

## Como está organizado

```
src/
  lib/rules/        regras puras e testadas: jarro, planeamento, XP, badges, restrições
  lib/              datas em Lisboa, sons chiptune, voz, câmara/compressão, formatos pt-PT
  data/             tipos, API (demo e Supabase), store, seed, exercises.json (278 exercícios em pt-PT)
  components/       UI base, ações do dia, pixel art (ícones e a mascote do jarro)
  pages/            Hoje, Calendário, Planear, Registar (foto), Player, Treinos, Plano, Exercício,
                    Jarro, Família, Perfil, Corpo (peso e IMC), admin/*
supabase/
  migrations/       esquema, lógica e seed
  functions/        admin-users (Edge Function)
```

A lógica do fecho do mês existe em dois sítios que fazem o mesmo: `src/lib/rules/jar.ts` (testada com Vitest, usada no modo demo e nos avisos de risco) e `run_maintenance()` em SQL (a que conta, no servidor). Se mudares uma, muda a outra.

## Notas

- Os treinos só se registam no próprio dia (ou no dia seguinte, quando ficam na fila sem rede).
- As fotos com mais de 90 dias são apagadas do Storage quando o admin abre a app (o Storage só se apaga pela API).
- A câmara na hora usa `getUserMedia`. Se o browser não deixar, a app abre a câmara do sistema e só aceita fotos tiradas nos últimos 10 minutos.
- Exercícios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (domínio público), filtrados pelo material da casa e traduzidos para pt-PT. As edições do admin ficam na tabela `exercise_edits`.
