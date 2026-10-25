# Plano: caminhadas v2 (ritmo fora, ecrã ligado, modo bolso e foto)

Plano para implementar no repositório `treino-em-casa` (React + Vite + TypeScript, Supabase).
Pode ser seguido à mão ou dado ao Claude Code no PC: "Lê o PLANO-caminhadas-v2.md e implementa tudo, pela ordem, e corre os testes no fim."

Regras da casa que se mantêm em tudo o que for escrito:

- Textos da app em pt-PT, sem travessão longo.
- Nunca dizer "polia", dizer "multiestação".
- Caminhadas a verde (tokens `--walk*` em `src/styles/app.css`), treinos a azul.
- As caminhadas continuam sem dar XP, sem contar como treino nem como dia marcado.

## Estado atual (ponto de partida)

O módulo de caminhadas já existe:

| Ficheiro | O que faz |
|---|---|
| `src/pages/Caminhada.tsx` | Ecrã ao vivo: mapa Leaflet, tempo, km, ritmo, Pausa, Terminar, resumo, Guardar |
| `src/lib/walk.ts` | Contas (haversine, simplificar percurso), formatos, caminhada ao vivo guardada em `localStorage` |
| `src/components/walk/WalkSheet.tsx` | Sheet "Caminhada": Começar ou Registar, sozinho ou acompanhado, formulário manual |
| `src/components/walk/RouteSvg.tsx` | Desenho do percurso no feed e no resumo |
| `src/data/api.ts`, `demoApi.ts`, `supabaseApi.ts` | `createWalk`, `deleteWalk`, `deleteAllWalks` |
| `supabase/migrations/20261025000009_caminhadas.sql` | Tabela `walks`, regras de acesso, `reset_activity` com caminhadas |

Hoje o ecrã ligado é pedido de forma escondida, num `useEffect` em `Caminhada.tsx` (`navigator.wakeLock.request('screen')`), sem opção nem aviso quando falha.

## Decisões (confirmar antes de começar)

1. **A foto é opcional.** Os treinos precisam de foto como prova, mas as caminhadas não dão XP, por isso não há nada a provar. Se a quiseres obrigatória, ver a nota no passo 4.6.
2. **Uma foto por caminhada,** tirada no fim (no resumo) ou escolhida da galeria. No registo manual também se pode juntar uma.
3. **Câmara traseira por omissão** (paisagem, o caminho), com botão para trocar para a frontal.
4. **A foto apaga-se ao fim de 90 dias,** como as dos treinos. A caminhada fica.
5. **"Manter o ecrã ligado" vem ligado por omissão,** e a escolha fica guardada no telemóvel.
6. **O modo bolso** só se abre quando a pessoa carrega no botão. Não entra sozinho.

## Ordem de trabalho

0. Tirar o campo do ritmo (min/km) (passo 0)
1. Ecrã ligado: opção e indicador (passo 1)
2. Plano B para o iPhone, com NoSleep.js (passo 2)
3. Modo bolso (passo 3)
4. Foto da caminhada (passo 4, o único que mexe na base de dados)
5. Testes, verificação no telemóvel e publicação (passos 5 a 7)

---

## Passo 0: tirar o campo do ritmo (min/km)

O ritmo (por exemplo "22:49 min/km") não interessa numa caminhada em família e só confunde. Sai do ecrã. Ficam só o tempo e os km.

- **`src/pages/Caminhada.tsx`:**
  - Apagar o terceiro bloco de `walk-stats`, o que tem `fmtPace(...)` e a etiqueta "min/km".
  - Tirar `fmtPace` da lista de imports de `../lib/walk`.
- **`src/styles/app.css`:**
  - Em `.walk-stats`, trocar `grid-template-columns: 1.3fr 1fr 1fr` por `grid-template-columns: 1fr 1fr`. O tempo e os km ficam lado a lado, a meias.
  - Os km passam a ter o mesmo tamanho do tempo: `.walk-stats b { font-size: 38px }`. O tempo continua verde (`.main b`), os km ficam na cor normal do texto.
- **`src/lib/walk.ts`:** apagar a função `fmtPace`, que deixa de ser usada em lado nenhum.
- **`src/lib/walk.test.ts`:**
  - Tirar `fmtPace` do import.
  - Apagar as duas linhas `expect(fmtPace(...))` do teste "formata km e ritmo".
  - Mudar o nome do teste para "formata km".
- **Confirmar com uma pesquisa** (`fmtPace` e "min/km" em `src/`) que não ficou mais nenhuma referência. O feed e o perfil não mostram ritmo, por isso não há mais nada a mudar.

---

## Passo 1: opção "Manter o ecrã ligado" com indicador

### 1.1 Novo ficheiro `src/lib/screenAwake.ts`

Junta num só sítio tudo o que mantém o ecrã ligado (o pedido normal e o plano B do passo 2).

```ts
export type AwakeStatus =
  | 'off'          // desligado pela pessoa
  | 'native'       // Wake Lock do browser ativo
  | 'fallback'     // plano B (vídeo invisível) ativo
  | 'failed'       // pedido recusado: avisar para pôr o bloqueio automático em "Nunca"

export interface ScreenAwake {
  enable(): Promise<AwakeStatus> // tem de ser chamado dentro de um toque (Começar, Continuar, ligar a opção)
  disable(): void
  status(): AwakeStatus
  onChange(cb: (s: AwakeStatus) => void): () => void
}
export function createScreenAwake(): ScreenAwake
```

Comportamento:

- `enable()`: tenta primeiro `navigator.wakeLock.request('screen')`. Se der, o estado fica `native`. Se não existir ou der erro, passa ao plano B (passo 2). Se também falhar, fica `failed`.
- **Ao voltar à app** (`visibilitychange` para `visible`), volta a pedir, porque o sistema solta o pedido sempre que a app sai do ecrã.
- **Se o sistema soltar o pedido** (evento `release` do `WakeLockSentinel`) com a app visível, tenta outra vez uma vez; se falhar, muda para `failed`.
- `disable()`: solta o pedido e para o plano B.

### 1.2 Preferência guardada

- Chave em `localStorage`: `tec-walk-keep-awake`, com `'1'` (ligado) ou `'0'` (desligado). Por omissão, ligado.
- Leitura e escrita sempre dentro de `try/catch`, como no resto da app.
- Funções pequenas em `src/lib/walk.ts`: `getKeepAwake(): boolean` e `setKeepAwake(v: boolean)`.

### 1.3 Ligar ao ecrã `src/pages/Caminhada.tsx`

- Apagar o `useEffect` atual do Wake Lock (o que tem `WakeLockLike`).
- Criar uma instância com `useRef(createScreenAwake())` e guardar o estado com `useState<AwakeStatus>`.
- **Quando pedir:** em `start()` e em `resume()`, se a opção estiver ligada, chamar `awake.enable()`. É obrigatório que seja nestes cliques, porque o iPhone só deixa o plano B arrancar a partir de um toque.
- **Quando soltar:** em `pause()`, no fim (resumo) e ao sair do ecrã (limpeza do efeito), chamar `awake.disable()`.
- **Ao reabrir com uma caminhada a decorrer** (vinda da faixa verde do Hoje), não há toque. Mostrar um botão "Manter o ecrã ligado" no aviso do indicador, que chama `enable()` ao ser tocado.

### 1.4 Interface no painel (`walk-panel`)

Por baixo das estatísticas (já só com tempo e km, ver passo 0), uma linha com:

- **Interruptor** com o componente `Switch` de `src/components/ui.tsx` e a etiqueta "Manter o ecrã ligado".
- **Indicador** de uma linha, conforme o estado:

| Estado | Texto | Cor |
|---|---|---|
| `native` ou `fallback` | "Ecrã sempre ligado" | verde (`--walk-text`) |
| `failed` | "O telemóvel não deixou. Põe o bloqueio automático em Nunca: Definições > Ecrã e brilho > Bloqueio automático." | laranja (`--warn`) |
| `off` | "O ecrã pode bloquear e o percurso para." | cinzento (`--muted`) |

- Apagar a frase atual "O tempo continua a contar com o ecrã bloqueado..." por baixo do botão Começar e trocar por: "O tempo conta sempre. O percurso só se desenha com o ecrã ligado."

### 1.5 CSS em `src/styles/app.css`

`.walk-awake` com `display: flex`, `align-items: center`, `gap: 10px` e `font-size: 13px`. Mais `.walk-awake.ok`, `.walk-awake.warn` e `.walk-awake.off` com as cores da tabela.

---

## Passo 2: plano B para o iPhone (NoSleep.js)

Em algumas versões do iOS, o Wake Lock não funciona nas apps instaladas no ecrã principal. O NoSleep.js resolve isso com um vídeo minúsculo, invisível e sem som, a repetir em fundo. Também usa o Wake Lock normal quando o browser o tem.

### 2.1 Instalar

```
npm install nosleep.js@0.12.0
```

Fica em `dependencies` no `package.json`. A versão 0.12.0 é a mais recente e não muda desde 2022.

### 2.2 Usar dentro de `screenAwake.ts`

```ts
import NoSleep from 'nosleep.js'
const noSleep = new NoSleep()
// no plano B:
await noSleep.enable()  // só funciona dentro de um toque
// noSleep.isEnabled diz se ficou ligado
// para desligar:
noSleep.disable()
```

- Só se usa quando o Wake Lock normal falha, para não gastar bateria com o vídeo sem necessidade.
- Se `enable()` der erro ou `isEnabled` ficar `false`, o estado passa a `failed`.
- O vídeo não aparece no ecrã nem tem som, por isso não interfere com música ou podcasts que estejam a tocar.

### 2.3 Tipos

Se o TypeScript se queixar de que não há tipos para `nosleep.js`, criar `src/types/nosleep.d.ts`:

```ts
declare module 'nosleep.js' {
  export default class NoSleep {
    isEnabled: boolean
    enable(): Promise<void>
    disable(): void
  }
}
```

---

## Passo 3: modo bolso

Ecrã preto por cima de tudo, para gastar menos bateria (nos ecrãs OLED dos iPhones recentes, preto é quase zero) e para o bolso não carregar em nada.

### 3.1 Novo componente `src/components/walk/PocketMode.tsx`

```ts
export function PocketMode({ open, elapsed, meters, onExit }: {
  open: boolean
  elapsed: number   // ms
  meters: number
  onExit: () => void
})
```

- **Fundo:** `position: fixed; inset: 0; z-index: 2000; background: #000`. Fica por cima do mapa e do painel.
- **Conteúdo:** ao centro, o tempo (`fmtClock`) e os km (`fmtKm`), em `#5a5a5a` (cinzento-escuro, para gastar pouco e não encandear). Por baixo, mais pequeno: "Mantém o dedo 2 segundos para desbloquear".
- **Mexer o texto alguns pixéis por minuto,** para não ficar sempre na mesma posição do ecrã.
- **Bloquear toques:** apanhar `pointerdown`, `click`, `touchmove` e `contextmenu` no próprio componente, com `preventDefault`. Juntar `touch-action: none`, `user-select: none`, `-webkit-user-select: none` e `-webkit-touch-callout: none`.
- **Desbloquear:** `pointerdown` arranca um temporizador de 2000 ms e um anel de progresso à volta do dedo (um `div` circular com `conic-gradient` a encher). `pointerup`, `pointercancel` ou `pointerleave` antes do fim cancelam. Ao fim de 2 s, uma vibração curta (`navigator.vibrate?.(30)`, se existir) e `onExit()`.
- **Acessibilidade:** `role="dialog"`, `aria-modal="true"`, `aria-label="Modo bolso"`. Tecla Esc também sai, para o computador e os testes.
- **O tempo continua a atualizar** (recebe `elapsed` do ecrã da caminhada, que já atualiza a cada segundo).

### 3.2 Ligar ao `Caminhada.tsx`

- Estado `const [pocket, setPocket] = useState(false)`.
- Botão "Modo bolso" no painel, só visível com a caminhada a decorrer (não em pausa nem no resumo), em `btn secondary block`, com o ícone `DeviceMobile` do Phosphor.
- **Ao entrar,** se a opção de ecrã ligado estiver ligada e o estado não for `native` nem `fallback`, chamar `awake.enable()` (o toque no botão serve de gesto). Sem ecrã ligado, o modo bolso não serve de nada.
- **Ao entrar, opcional:** pedir ecrã inteiro (`document.documentElement.requestFullscreen?.()`, dentro de `try`). No iPhone não existe e não faz mal.
- **Ao sair:** `setPocket(false)`; se tiver entrado em ecrã inteiro, `document.exitFullscreen?.()`.
- **O GPS continua a correr** por baixo do ecrã preto, e o percurso continua a desenhar-se.

### 3.3 CSS

Classes `.pocket`, `.pocket-time`, `.pocket-km`, `.pocket-hint` e `.pocket-ring`. Respeitar `prefers-reduced-motion`: sem o deslocamento do texto e com o anel sem animação suave.

---

## Passo 4: foto da caminhada

### 4.1 Migração nova `supabase/migrations/20261026000010_caminhadas_foto.sql`

```sql
alter table public.walks add column if not exists photo_path text;
alter table public.walks add column if not exists photo_taken_at timestamptz;
```

Atualizar a função `public.walks_guard()` (copiar a da 0009 e mudar só o bloco do UPDATE):

- **Ao atualizar,** a foto só pode ser apagada (passar a `null`), nunca trocada por outra. Ou seja: se `new.photo_path is not null and new.photo_path is distinct from old.photo_path`, dar erro "A foto não se troca depois de guardar."
- **Ao inserir,** se vier foto, o caminho tem de começar pela pasta de quem registou: `split_part(new.photo_path, '/', 1) = new.profile_id::text`.

Limpeza dos 90 dias (funções novas, para não mudar a assinatura das que existem):

```sql
create or replace function public.walk_photos_to_cleanup()
returns table (id uuid, photo_path text) language sql stable security definer set search_path = public as $$
  select id, photo_path from walks where is_admin() and photo_path is not null and date < today_lisbon() - 90
$$;
grant execute on function public.walk_photos_to_cleanup() to authenticated;

create or replace function public.mark_walk_photos_cleaned(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Só um admin.'; end if;
  perform set_config('app.system', 'on', true);
  update walks set photo_path = null where id = any (p_ids) and date < today_lisbon() - 90;
  perform set_config('app.system', '', true);
end $$;
grant execute on function public.mark_walk_photos_cleaned(uuid[]) to authenticated;
```

O Storage não precisa de regras novas: as fotos vão para o bucket `photos`, na pasta de cada pessoa, que já tem as regras certas (só o próprio escreve, a família lê, o próprio ou o admin apaga).

Testar na base de dados local, como nas outras migrações:

- Inserir com foto na pasta certa: aceita.
- Inserir com foto na pasta de outra pessoa: dá erro.
- Atualizar para outra foto: dá erro.
- Atualizar para `null`: aceita.

### 4.2 Tipos (`src/data/types.ts`)

Em `Walk`, acrescentar:

```ts
photo_path: string | null // null = sem foto, ou apagada
photo_taken_at: string | null
```

Em `src/data/api.ts`:

- `NewWalk` passa a ter `photo?: Blob | null` (fora dos campos da tabela).
- Nova função: `hideWalkPhoto(walkId: string): Promise<void>`.

### 4.3 Supabase (`src/data/supabaseApi.ts`)

- **`createWalk`:**
  1. Gerar o id no telemóvel com `crypto.randomUUID()`.
  2. Se houver foto, carregar para `photos/${uid}/walk-${id}.jpg` com `contentType: 'image/jpeg'`.
  3. Inserir a linha com `id`, `photo_path` e `photo_taken_at`.
  4. Se a inserção falhar, apagar a foto já carregada, para não ficar perdida no Storage.
- **`hideWalkPhoto`:** apagar o ficheiro no Storage e depois `update walks set photo_path = null`.
- **`deleteWalk`:** antes de apagar a linha, ler o `photo_path` e apagar o ficheiro.
- **`deleteAllWalks`:** ler todos os `photo_path` não nulos e apagar os ficheiros com `storage.remove`, aos grupos de 100. Depois apagar as linhas como hoje.
- **`runMaintenance` (só o admin):** depois da limpeza das fotos dos treinos, fazer o mesmo com `walk_photos_to_cleanup` e `mark_walk_photos_cleaned`.
- `resetActivity` já apaga todos os ficheiros das pastas de cada pessoa, por isso apanha as fotos das caminhadas sem mudanças.

### 4.4 Modo demo (`src/data/demoApi.ts`)

Copiar o que já se faz com as fotos dos treinos:

- **Guardar:** `idbSet('photo:' + path, blob)`, com `path = demo-walk-${id}.jpg`.
- **Apagar:** `idbDel` em `deleteWalk`, `hideWalkPhoto`, `deleteAllWalks` e `resetActivity`.
- **Limpeza dos 90 dias** em `runMaintenance`: pôr `photo_path = null` nas caminhadas com mais de 90 dias, como nos treinos.
- **Dados antigos:** na migração dentro de `load()`, garantir `photo_path ??= null` e `photo_taken_at ??= null` em cada caminhada guardada.

O componente `Photo` de `src/components/ui.tsx` já sabe mostrar caminhos do demo e do Supabase, por isso serve sem mudanças.

### 4.5 Câmara reutilizável

Hoje a câmara está escrita dentro de `src/pages/Registar.tsx` (o `getUserMedia`, a função `take()`, o recorte 4:5, `compressImage` e o `input type="file"` para quando a câmara não abre).

- **Extrair** para `src/components/CameraCapture.tsx`:

```ts
export function CameraCapture({ title, hint, defaultFacing, onShot, onCancel }: {
  title: string               // "Foto do treino" ou "Foto da caminhada"
  hint: string                // texto pequeno ao lado do botão
  defaultFacing: 'user' | 'environment'
  onShot: (shot: { blob: Blob; url: string; at: string }) => void
  onCancel: () => void
})
```

- **`Registar.tsx` passa a usar o componente** com `defaultFacing="user"` e os mesmos textos de hoje. Confirmar que o registo de treino continua exatamente igual.
- **Nas caminhadas,** `defaultFacing="environment"` e a dica "Mostra o caminho, ou quem foi contigo!".

### 4.6 Interface

**Resumo no fim da caminhada ao vivo (`Caminhada.tsx`):**

- **Antes da foto:** por baixo do desenho do percurso, um botão `btn walk-soft big block` "Tirar foto" com o ícone `Camera`. Ao lado, ou por baixo, um botão pequeno "Escolher da galeria" (`input type="file" accept="image/*"` sem `capture`).
- **Câmara:** ao tirar foto, abre o `CameraCapture` por cima, em ecrã inteiro.
- **Depois da foto:** pré-visualização em 4:5 com os botões "Trocar" e "Tirar".
- **Ao guardar:** a foto vai em `createWalk({ ..., photo })`.
- **Se a quiseres obrigatória:** desativar "Guardar caminhada" sem foto, com a mensagem "Falta a foto da caminhada.", e acrescentar o mesmo controlo no `walks_guard` (`photo_path is not null` ao inserir).

**Registo manual (`WalkSheet.tsx`, passo `form`):**

- Campo "Foto (opcional)" com um botão que abre a galeria ou a câmara (`input type="file" accept="image/*"`).
- Pré-visualização pequena, com um "×" para tirar.
- Comprimir com `compressImage` antes de guardar.

**Feed (`src/pages/Familia.tsx`, cartão `walk-post`):**

- Se houver foto, mostrar `<Photo path={w.photo_path} className="post-photo" />` por cima do desenho do percurso.
- Se houver foto e percurso, o desenho fica mais baixo (`height={100}`) por baixo da foto.
- **Menu dos três pontinhos** (só quem registou):
  - "Apagar a foto" (se houver), com o texto "A caminhada continua no feed, sem a foto."
  - "Apagar a caminhada", como hoje.

---

## Passo 5: testes automáticos

Correr `npx tsc -b`, `npx vitest run` e `npm run build`. Tudo tem de passar.

Testes novos em `src/lib/walk.test.ts` (ou num ficheiro novo):

- `getKeepAwake()` devolve `true` sem nada guardado, e devolve o que foi guardado com `setKeepAwake`.
- `createScreenAwake()` com um `navigator.wakeLock` falso que funciona: o estado passa a `native`.
- `createScreenAwake()` com um que dá erro e um NoSleep falso que também falha: o estado passa a `failed`.
- Modo bolso: largar o dedo antes dos 2 s não chama `onExit`; ao fim de 2 s chama. Usar `vi.useFakeTimers()` e testar a lógica numa função separada do componente.

---

## Passo 6: verificação no telemóvel (iPhone com a app instalada)

1. Abrir uma caminhada, carregar em Começar e confirmar que o indicador diz "Ecrã sempre ligado".
2. Pousar o telemóvel 2 minutos sem tocar e confirmar que o ecrã não bloqueia sozinho.
3. Desligar a opção e confirmar que o indicador muda para cinzento e que o ecrã volta a bloquear sozinho, com o tempo normal das definições.
4. Entrar no modo bolso e confirmar:
   - O ecrã fica preto.
   - Os toques normais não fazem nada.
   - Manter o dedo 2 s sai.
   - O tempo e os km continuam a subir.
5. Andar uns minutos com o telemóvel no bolso, em modo bolso, e confirmar que o percurso fica desenhado sem linhas retas e sem o aviso "O GPS parou".
6. Confirmar que o painel só mostra o tempo e os km, sem o ritmo (min/km).
7. No fim, tirar a foto com a câmara traseira, guardar e ver a caminhada no feed com a foto e o percurso.
8. Registar uma caminhada manual com foto da galeria e ver no feed.
9. Apagar a foto de uma caminhada no menu dos três pontinhos: a caminhada fica, sem foto.
10. No backoffice, em Repor, carregar em "Apagar todas as caminhadas" e confirmar que as fotos também desaparecem (no Supabase: Storage > photos).
11. Confirmar que o registo de um treino normal (com foto) continua a funcionar como antes.

Lembrete que pode ir para a ajuda do ecrã da caminhada: o botão lateral bloqueia sempre o telemóvel, e mudar para outra app também para o GPS. Nenhuma app web consegue impedir isso.

---

## Passo 7: publicar

No Terminal, dentro da pasta `treino-em-casa`:

```
npm install
npx supabase db push
npm run build
git add .
git commit -m "Caminhadas: sem ritmo, ecrã ligado, modo bolso e foto"
git push
```

Se a migração 0009 (caminhadas) ainda não tiver sido aplicada, o `db push` aplica a 0009 e a 0010 de seguida.

## Ficheiros tocados (resumo)

| Novo | Alterado |
|---|---|
| `src/lib/screenAwake.ts` | `src/pages/Caminhada.tsx` |
| `src/components/walk/PocketMode.tsx` | `src/components/walk/WalkSheet.tsx` |
| `src/components/CameraCapture.tsx` | `src/pages/Registar.tsx` (passa a usar `CameraCapture`) |
| `supabase/migrations/20261026000010_caminhadas_foto.sql` | `src/pages/Familia.tsx` |
| `src/types/nosleep.d.ts` (se for preciso) | `src/lib/walk.ts`, `src/lib/walk.test.ts` |
| | `src/data/types.ts`, `api.ts`, `demoApi.ts`, `supabaseApi.ts` |
| | `src/styles/app.css`, `package.json`, `package-lock.json` |
| | `DECISOES.md` (acrescentar: foto opcional, ecrã ligado, modo bolso) |
