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
- Semanas cortadas no início e no fim do mês: 1 só dia no mês não tem mínimo, 2 a 4 dias pedem 1 dia, 5 ou mais pedem 2 (outubro de 2026: 1 + 2 + 2 + 2 + 2 = 9).
- Planeia-se do **dia 1 ao dia 5** (recomendado). A app **nunca marca dias sozinha**, a não ser que a pessoa ligue "Repetir todas as semanas" no Calendário > O meu: aí copia os dias (e o treino de cada um) da primeira semana marcada para o resto do mês e para o mês seguinte, e no dia 1 de cada mês preenche o mês novo.
- O mínimo é 2 dias por semana (1 nas semanas cortadas), mas cada pessoa pode marcar **quantos dias quiser**.
- Tocar num dia no Calendário marca-o e abre logo os detalhes para escolher o treino.
- Os dias mudam-se a qualquer altura **dentro do mês**. Nada passa para o mês seguinte.
- Um dia falhado fica "Por recuperar" só **até ao fim da sua semana** (domingo) e só se muda para um dia dessa semana. Quando a semana acaba conta como falha e já não se muda (a desculpa ainda se pode pedir até o mês fechar). Decidido a 17 de novembro de 2026.
- O mínimo semanal conta só no planeamento.
- Só se tira um dia (sem o mudar) se a semana continuar com o mínimo.

## Registo do treino

- O treino só conta com uma **foto** tirada no fim, com a câmara, na hora (sem galeria).
- A foto fica com data e hora, é comprimida para cerca de 200 KB e vai **automaticamente para o feed**.
- A pessoa pode apagar a foto do feed. O treino continua a contar.
- Sem rede, o treino fica guardado no telemóvel e é enviado quando a ligação voltar.
- As fotos são apagadas ao fim de 90 dias (fica o registo do treino).
- Um treino por pessoa por dia conta para as contas.

## Jarro

- **Regra semanal (desde 2 de novembro de 2026): conta o que se faz, não o que se marca.** Cada semana (segunda a domingo) pede o mínimo de treinos feitos (2; nas semanas cortadas do mês, o mínimo proporcional). Cada treino em falta custa **2,50 €**: semana sem treinos = 5 €, com 1 treino = 2,50 €, com 2 = nada. Quem se esquece de marcar os dias paga na mesma se não treinar. Uma desculpa aprovada conta como treino.
- A multa é lançada no **fecho da semana**: na segunda-feira (manutenção de hora a hora) entra no jarro como "por pagar". Se houver uma desculpa por decidir nessa semana, espera pela decisão.
- Uma desculpa decidida depois do fecho refaz a multa dessa semana, se ainda estiver por pagar (se já foi paga, o admin corrige no Jarro).
- Marcar dias continua a servir para planear e para os avisos. Um dia falhado fica "Por recuperar" até domingo.
- Teto de **20 € por pessoa por mês** (desde 17 de novembro de 2026; antes 15 €).
- No **dia 1 às 00h15** (Lisboa) fecha-se o mês anterior (marca os dias e regista o resumo).
- Repor os dados muda o início da regra semanal para a semana atual, para não cobrar semanas antigas.
- Antes de novembro de 2026 a regra era 5 € por cada falha a partir da segunda seguida, no fecho do mês (fica disponível em Regras com "a partir da falha n.º" 2 ou mais).
- Desculpas (doente, lesão, viagem, outro) são aprovadas pelo admin. O admin aprova as suas, com registo na auditoria e no feed. Se no **dia 5 do mês seguinte às 23h59** ainda não houver decisão, é aceite automaticamente.
- O dinheiro é gasto em conjunto. A app não mexe em dinheiro real.
- Os fechos são idempotentes e tudo fica na auditoria.
- No backoffice (Jarro) o admin pode corrigir qualquer movimento (valor, motivo, estado) ou apagá-lo com motivo. Em Desculpas pode mudar uma decisão (aprovada ↔ recusada); o dia acompanha.
- 17 de novembro de 2026: Paula Almeida e Pedro Carreira meteram 10 € cada no pote (entrada no jarro).

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

## Caminhadas (outubro de 2026)

- Botão verde "Registar caminhada" no Hoje. Duas opções: registar à mão (dia, minutos, km opcional) ou começar ao vivo (tempo, km, ritmo e percurso no mapa).
- Primeiro pergunta se é sozinho ou acompanhado. A caminhada fica registada uma vez, por quem a registou, e conta para todos os que foram.
- Não dão XP, não contam como dia marcado nem como treino, não entram na meta da família. Aparecem no feed e têm 9 conquistas próprias (secção "Caminhadas" no perfil).
- O tempo conta a partir das horas de início e das pausas, por isso continua certo com o ecrã bloqueado. O GPS de uma app web só funciona com a app aberta, por isso o ecrã fica ligado durante a caminhada; se o GPS parar, esse troço fica em linha reta.
- Mapa com Leaflet e OpenStreetMap, só carregado no ecrã da caminhada.
- Só quem registou (ou o admin) apaga uma caminhada. No backoffice, em Repor, há um botão para apagar todas as caminhadas.

## Eliminar dias marcados

- Um dia de hoje em diante pode ser sempre eliminado, mesmo que a semana fique abaixo do mínimo. A app avisa quantos dias ficam. Os dias que já passaram continuam a não se poder eliminar.

## Caminhadas v2 (outubro de 2026)

- Sem ritmo (min/km) no ecrã da caminhada: só tempo e km.
- "Manter o ecrã ligado" no ecrã da caminhada, ligado por omissão e guardado no telemóvel. Primeiro usa o Wake Lock; se falhar, o plano B do NoSleep.js (vídeo invisível e sem som). Se nada der, aparece o aviso para pôr o bloqueio automático em "Nunca".
- Modo bolso: ecrã preto com o tempo e os km, toques bloqueados, sai mantendo o dedo 2 segundos. Só entra quando a pessoa carrega no botão.
- Foto da caminhada opcional (câmara traseira por omissão, ou da galeria; também no registo manual). Aparece no feed por cima do percurso, quem registou pode apagá-la, e apaga-se ao fim de 90 dias como as dos treinos.
- O botão lateral do telemóvel e mudar para outra app continuam a parar o GPS. Uma app web não consegue impedir isso.

## Material novo

- Elíptica (5 exercícios) e bola de Pilates (15 exercícios), ambas OK.
- Verde das caminhadas mais fresco (#3ccb8a) e sapatilha em pixel art como símbolo das caminhadas.
