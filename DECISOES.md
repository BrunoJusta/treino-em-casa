# Decisões tomadas (23 de outubro de 2026)

Registo das decisões fechadas com o Bruno antes de construir. Quando uma regra mudar, atualiza-se aqui e no backoffice.

## Produto

- Nome: **Treino em Casa**.
- Família: 5 adultos (Bruno 28, irmã 36, cunhado 31, mãe 56, padrasto 54). Cada um usa o seu telemóvel. Não há tablet partilhado.
- Só contam treinos no ginásio de casa. Os treinos fora não se registam e, num dia marcado, contam como falha.
- Âmbito desta versão: Fases 1 a 3 do brief (MVP, treino guiado, gamificação). Ficam de fora: notificações push, Bluetooth do remo e estatísticas anuais.

## Acesso

- Sem Google. O admin cria cada pessoa no backoffice com um nome de utilizador e um código de 6 dígitos.
- Ecrã de entrada: toca-se no avatar e escreve-se o código. A sessão fica guardada no telemóvel.
- A pessoa pode mudar o código no perfil. Se o esquecer, o admin gera um novo.
- Foto de perfil carregada pela pessoa (ou pelo admin). Sem foto, aparecem as iniciais na cor da pessoa.

## Planeamento

- Mínimo de **2 dias por semana** (de segunda a domingo).
- Semanas cortadas no início e no fim do mês: 4 dias ou menos no mês pedem 1 dia, 5 ou mais pedem 2 (outubro de 2026: 1 + 2 + 2 + 2 + 2 = 9).
- Planeia-se do **dia 1 ao dia 5** (recomendado). A app **nunca marca dias sozinha**, a não ser que a pessoa ligue "Repetir todas as semanas" no Calendário > O meu: aí copia os dias (e o treino de cada um) da primeira semana marcada para o resto do mês e para o mês seguinte, e no dia 1 de cada mês preenche o mês novo.
- O mínimo é 2 dias por semana (1 nas semanas cortadas), mas cada pessoa pode marcar **quantos dias quiser**.
- Tocar num dia no Calendário marca-o e abre logo os detalhes para escolher o treino.
- Os dias mudam-se a qualquer altura **dentro do mês**, incluindo dias que já passaram e foram falhados. Nada passa para o mês seguinte.
- O mínimo semanal conta só no planeamento. Para recuperar dias, pode usar-se qualquer semana do mês.
- Só se tira um dia (sem o mudar) se a semana continuar com o mínimo.

## Registo do treino

- O treino só conta com uma **foto** tirada no fim, com a câmara, na hora (sem galeria).
- A foto fica com data e hora, é comprimida para cerca de 200 KB e vai **automaticamente para o feed**.
- A pessoa pode apagar a foto do feed. O treino continua a contar.
- Sem rede, o treino fica guardado no telemóvel e é enviado quando a ligação voltar.
- As fotos são apagadas ao fim de 90 dias (fica o registo do treino).
- Um treino por pessoa por dia conta para as contas.

## Jarro

- **5 € por cada falha a partir da segunda seguida** (falha, falha = 5 €; mais uma = mais 5 €).
- Um treino feito, ou uma desculpa aprovada, põe o contador a zero.
- Durante o mês, os dias falhados ficam "Por recuperar", com aviso de risco.
- No **dia 1 às 00h15** (Lisboa) fecha-se o mês anterior e lançam-se as multas. O contador não passa de um mês para o outro.
- Teto de **15 € por pessoa por mês**.
- Desculpas (doente, lesão, viagem, outro) são aprovadas pelo admin. O admin aprova as suas, com registo na auditoria e no feed.
- Desculpa pendente: o dia não conta como falha. O fecho do mês dessa pessoa espera pela decisão. Se no **dia 5 às 23h59** ainda não houver decisão, é aceite automaticamente.
- O dinheiro é gasto em conjunto. A app não mexe em dinheiro real.
- O fecho é idempotente e tudo fica na auditoria.

## Gamificação

- XP: dia marcado feito 50, treino extra 30, treino guiado completo +20, semana cumprida +50, mês planeado a tempo 30, aplauso 2 (máx. 10 por dia), treino a dois +10.
- Níveis: Caracol → Novato → Proficiente → Experiente → Mestre → Lenda.
- Streak de semanas cumpridas, com escudo a cada 4 semanas seguidas.
- Ranking por consistência (dias marcados cumpridos), desempate pelo número de treinos feitos.
- Badges individuais e da família, meta mensal da família e feed com reações.

## Perfil e corpo

- Peso e IMC **privados**: só a própria pessoa vê, nem o admin (garantido por RLS). Nunca entram no feed, no ranking nem no calendário.
- Altura uma vez; peso quando quiser, com lembrete semanal opcional; gráfico de 30 dias, 3 meses ou 1 ano; IMC com as faixas da OMS em cor neutra; peso-objetivo opcional.
- Restrições físicas (por exemplo "sem saltos", "sem corrida") só visíveis à pessoa e aos admins. O construtor de planos avisa quando um exercício choca com elas.

## Player de treino

- Um exercício de cada vez, descanso automático, beeps nos últimos 3 segundos, vibração, voz em pt-PT (desligável) e ecrã sempre ligado.

## Exercícios

- Fonte: free-exercise-db (domínio público), filtrada pelo material da casa: 266 exercícios traduzidos para pt-PT com o glossário, mais 12 exercícios próprios da casa. Ficaram de fora os que precisam do cabo de baixo da multiestação (avariado).
- 37 exercícios-semente entram como revistos; os outros ficam "por rever" no backoffice.
- Nos textos da app diz-se sempre "multiestação" (nunca "polia").
- Sem imagens: cada exercício tem um ícone em pixel art do padrão de movimento e outro do material.

## Visual

- Base do Antigravity: fundo branco, texto `#4C4F69`, destaque `#39C2EF`, cartões arredondados. Só modo claro.
- Fonte Outfit em toda a app.
- Pixel art 8-bit nos momentos de festa: a mascote do jarro (frasco com moedas empilhadas), badges, subidas de nível, confetes e sons chiptune.

## Técnica

- React + Vite + TypeScript, PWA. Supabase (Postgres com RLS, Auth, Storage, Realtime, Edge Function, pg_cron). Deploy na Vercel. Repositório `BrunoJusta/treino-em-casa`.
