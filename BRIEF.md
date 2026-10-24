# Brief: Treino em Casa

Versão atualizada a 23 de outubro de 2026, depois das três rondas de perguntas. As regras ao pormenor estão em [DECISOES.md](DECISOES.md). Este documento explica o produto.

## 1. Problema e objetivo

Há um ginásio montado em casa, lá em baixo, que é pouco usado. A app põe a família toda a treinar com um compromisso partilhado: cada pessoa marca os dias em que vai treinar, regista o treino com uma foto, e quem falhar dois dias marcados seguidos mete 5 € no jarro da família. Tem de ser divertida, com gamificação, e fácil para todas as idades.

## 2. Princípios

1. **Cooperativo antes de competitivo.** Metas da família, conquistas coletivas e um jarro gasto em conjunto. O ranking mede consistência, nunca carga nem volume.
2. **Moderado ganha a intenso.** O streak conta semanas cumpridas, não dias seguidos.
3. **Um toque para o essencial.** "Começar treino" e "Já treinei" estão no topo do ecrã Hoje.
4. **Penalização justa e transparente.** Regras sempre visíveis no ecrã do jarro, dias recuperáveis dentro do mês, desculpas aprovadas pelo admin e prazo automático.
5. **O corpo é privado.** Peso e IMC só os vê a própria pessoa. As fotos do treino vão para o feed (decisão da família), mas a pessoa pode apagá-las.
6. **Tudo em pt-PT.**

## 3. Pessoas

- 5 adultos (28 a 56 anos), cada um no seu telemóvel, com a app instalada no ecrã principal.
- O Bruno é admin. Pode haver mais admins.
- Entrada com nome de utilizador e código de 6 dígitos criados pelo admin. Sem Google.

## 4. Material da casa

| Material | Estado |
|---|---|
| Multiestação (puxada, butterfly, pullover, cabo de cima (o de baixo está avariado), extensão e flexão de pernas, adutor, banco abdominal) | Em casa |
| Bicicleta estática Domyos Essential | Em casa |
| Passadeira Domyos | Em casa |
| Halteres ajustáveis (discos em plástico) | Em casa |
| Halteres de 3 kg (Bodytone) | Em casa |
| Caneleiras | Em casa |
| Máquina de remo Domyos Initial Rower 100 | A chegar |
| Banco Zipro Core | A chegar |
| Kit Domyos de 50 kg em ferro | A chegar |

Tudo editável em Backoffice > Material.

## 5. Ecrãs

1. **Entrada**: avatares da família e teclado de código.
2. **Hoje**: treino marcado, Começar treino, Já treinei, dias por recuperar, risco de multa, planear o mês, streak, nível, meta da família e quem já treinou.
3. **Calendário**: mês da família (um ponto por pessoa e por estado) ou só o meu. Tocar num dia mostra quem treinou e, nos meus dias, mudar, pedir desculpa ou tirar.
4. **Planear**: tocar nos dias, mínimo por semana, repetir o padrão do mês passado, treino por dia da semana.
5. **Registar**: câmara na hora, pré-visualização, tempo de treino, publicar no feed.
6. **Player**: contagem 3, 2, 1; um exercício de cada vez; séries, repetições, carga (+/- 1 kg), cronómetro e descanso com anel; voz pt-PT; ecrã sempre ligado; no fim, a foto.
7. **Treinos**: planos da família e meus, e a biblioteca de exercícios com pesquisa e filtros.
8. **Plano**: construtor com exercícios da biblioteca, ordenar (arrastar ou setas), séries, repetições ou tempo, descanso, carga e notas, com avisos de restrições.
9. **Exercício**: ícones, músculos, material, passos em pt-PT e link para vídeos.
10. **Jarro**: a mascote (frasco de moedas em pixel art), total, meta, quem deve, regras e histórico.
11. **Família**: feed com fotos e reações, ranking do mês, conquistas e níveis.
12. **Perfil**: foto, nível, estatísticas, conquistas, restrições privadas, voz, código, sair.
13. **Corpo** (privado): peso, IMC, gráfico, objetivo e lembrete semanal.

## 6. Backoffice

Resumo, desculpas, pessoas (criar, editar, foto, código novo), material, exercícios (rever tradução, padrão, material, esconder, criar), jarro (pagamentos, gastos, anular com motivo), regras (multa, teto, prazos, metas), registo de auditoria e exportação CSV.

## 7. Gamificação

XP por treino, semana cumprida, planear a tempo, aplausos e treino a dois. Níveis Caracol → Novato → Proficiente → Experiente → Mestre → Lenda. 15 conquistas (3 da família). Meta mensal da família com prémio. Confetes, sons chiptune e vibração nos momentos de festa.

## 8. Fora desta versão

Notificações push, ligação Bluetooth ao remo (FTMS) e estatísticas do ano. Ficam para a Fase 4.
