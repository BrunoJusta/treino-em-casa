// Frases que o Jarro diz quando lhe tocam no ecrã Hoje.
// 150 frases: estoicas (com autor, traduções livres) e motivacionais da casa (sem autor).

export interface Quote {
  text: string
  author?: string
}

const STOICS: Quote[] = [
  // Marco Aurélio
  { text: 'Tens poder sobre a tua mente, não sobre o que acontece lá fora. Percebe isto e encontras a tua força.', author: 'Marco Aurélio' },
  { text: 'O que impede a ação faz avançar a ação. O que está no caminho torna-se o caminho.', author: 'Marco Aurélio' },
  { text: 'A felicidade da tua vida depende da qualidade dos teus pensamentos.', author: 'Marco Aurélio' },
  { text: 'Não percas mais tempo a discutir o que deve ser uma boa pessoa. Sê uma.', author: 'Marco Aurélio' },
  { text: 'De manhã, quando custar a levantar, pensa: levanto-me para fazer o trabalho de um ser humano.', author: 'Marco Aurélio' },
  { text: 'Se não está certo, não o faças. Se não é verdade, não o digas.', author: 'Marco Aurélio' },
  { text: 'A melhor vingança é não seres como quem te fez mal.', author: 'Marco Aurélio' },
  { text: 'É preciso muito pouco para uma vida feliz.', author: 'Marco Aurélio' },
  { text: 'Faz cada coisa como se fosse a última da tua vida.', author: 'Marco Aurélio' },
  { text: 'A alma ganha a cor dos seus pensamentos.', author: 'Marco Aurélio' },
  { text: 'Aceita as coisas a que o destino te liga e ama as pessoas com quem o destino te junta.', author: 'Marco Aurélio' },
  { text: 'O universo é mudança. A nossa vida é o que os nossos pensamentos fazem dela.', author: 'Marco Aurélio' },
  { text: 'Quando acordares, lembra-te do privilégio que é estar vivo: respirar, pensar, gozar, amar.', author: 'Marco Aurélio' },
  { text: 'Nada acontece a ninguém que a natureza não o tenha preparado para aguentar.', author: 'Marco Aurélio' },
  { text: 'Pensa no pouco tempo que tens e não o desperdices.', author: 'Marco Aurélio' },
  { text: 'Concentra-te, a cada momento, em fazer bem o que tens à frente.', author: 'Marco Aurélio' },
  { text: 'Olha para dentro. Dentro está a fonte do bem, sempre pronta a brotar, se continuares a cavar.', author: 'Marco Aurélio' },
  { text: 'Vive de acordo com a natureza e nunca serás pobre.', author: 'Marco Aurélio' },
  // Séneca
  { text: 'Sofremos mais na imaginação do que na realidade.', author: 'Séneca' },
  { text: 'Não é que tenhamos pouco tempo. É que desperdiçamos muito.', author: 'Séneca' },
  { text: 'Enquanto adiamos, a vida passa.', author: 'Séneca' },
  { text: 'Começa já a viver e conta cada dia como uma vida inteira.', author: 'Séneca' },
  { text: 'Não é por as coisas serem difíceis que não ousamos. É por não ousarmos que são difíceis.', author: 'Séneca' },
  { text: 'A dificuldade fortalece a mente, como o trabalho fortalece o corpo.', author: 'Séneca' },
  { text: 'Nenhum vento é favorável para quem não sabe para onde vai.', author: 'Séneca' },
  { text: 'Enquanto ensinamos, aprendemos.', author: 'Séneca' },
  { text: 'Pobre não é quem tem pouco, é quem deseja mais.', author: 'Séneca' },
  { text: 'Junta-te a quem te torna melhor.', author: 'Séneca' },
  { text: 'Onde houver um ser humano, há uma oportunidade para a bondade.', author: 'Séneca' },
  { text: 'Às vezes, até viver é um ato de coragem.', author: 'Séneca' },
  { text: 'O fogo põe o ouro à prova. A adversidade põe à prova os fortes.', author: 'Séneca' },
  { text: 'Ninguém é mais infeliz do que quem nunca enfrentou a adversidade.', author: 'Séneca' },
  { text: 'Se queres ser amado, ama.', author: 'Séneca' },
  { text: 'A verdadeira felicidade é gozar o presente, sem depender ansiosamente do futuro.', author: 'Séneca' },
  { text: 'Só o tempo é verdadeiramente nosso.', author: 'Séneca' },
  { text: 'Uma joia não se pule sem atrito, nem uma pessoa se aperfeiçoa sem provações.', author: 'Séneca' },
  { text: 'Cada dia que passa é um passo dado. Que seja na direção certa.', author: 'Séneca' },
  { text: 'Quem está em todo o lado não está em lado nenhum.', author: 'Séneca' },
  // Epicteto
  { text: 'Não são as coisas que nos perturbam, é a opinião que temos delas.', author: 'Epicteto' },
  { text: 'Primeiro diz a ti mesmo o que queres ser. Depois faz o que tens de fazer.', author: 'Epicteto' },
  { text: 'Ninguém é livre se não for senhor de si mesmo.', author: 'Epicteto' },
  { text: 'Não expliques a tua filosofia. Vive-a.', author: 'Epicteto' },
  { text: 'A riqueza não está em ter muitas coisas, mas em ter poucos desejos.', author: 'Epicteto' },
  { text: 'Se queres melhorar, aceita parecer tolo no início.', author: 'Epicteto' },
  { text: 'Nada de grande se cria de repente.', author: 'Epicteto' },
  { text: 'Há coisas que dependem de nós e coisas que não dependem. Cuida das primeiras.', author: 'Epicteto' },
  { text: 'É impossível aprender o que se pensa que já se sabe.', author: 'Epicteto' },
  { text: 'As circunstâncias não fazem a pessoa. Apenas a revelam.', author: 'Epicteto' },
  { text: 'Quanto mais valorizamos o que não controlamos, menos controlamos.', author: 'Epicteto' },
  { text: 'Treina-te nas coisas pequenas e depois passa às grandes.', author: 'Epicteto' },
  { text: 'Lembra-te de que és um ator numa peça. Cabe-te representar bem o teu papel.', author: 'Epicteto' },
  // Outros
  { text: 'Se fizeres algo bom com esforço, o esforço passa e o bem fica.', author: 'Musónio Rufo' },
  { text: 'Temos dois ouvidos e uma boca para ouvirmos o dobro do que falamos.', author: 'Zenão de Cítio' },
  { text: 'O bem-estar consegue-se aos poucos, mas não é coisa pequena.', author: 'Zenão de Cítio' },
]

const HOUSE: Quote[] = [
  { text: 'Lá em baixo ninguém te julga. Só os halteres, e esses não falam.' },
  { text: 'Dez minutos contam mais do que zero minutos.' },
  { text: 'Não precisas de vontade. Precisas de descer as escadas.' },
  { text: 'O treino mais difícil é o que ainda não começaste.' },
  { text: 'Hoje não tens de ser o melhor. Tens de aparecer.' },
  { text: 'Cada moeda que não cai em mim é uma vitória tua.' },
  { text: 'Eu gosto de moedas, mas gosto mais de te ver a treinar.' },
  { text: 'A consistência ganha à intensidade. Todas as vezes.' },
  { text: 'Um dia mau de treino é melhor do que um dia bom no sofá.' },
  { text: 'Não contes os dias. Faz com que os dias contem.' },
  { text: 'Começa leve. O importante é começar.' },
  { text: 'O teu eu de amanhã agradece o que fizeres hoje.' },
  { text: 'Sobe a carga devagar. A pressa é amiga das lesões.' },
  { text: 'Respira fundo. Uma série de cada vez.' },
  { text: 'O suor de hoje é a força de amanhã.' },
  { text: 'Pequenos passos todos os dias fazem grandes mudanças.' },
  { text: 'Não paras quando estás cansado. Paras quando acabaste.' },
  { text: 'O ginásio fica a uns degraus de distância. Mais perto é impossível.' },
  { text: 'Os músculos crescem no descanso. Mas primeiro tens de os cansar.' },
  { text: 'A motivação abre a porta. O hábito é que fica lá dentro.' },
  { text: 'Treinar em família é a melhor equipa que há.' },
  { text: 'Se alguém já treinou hoje, ainda vais a tempo de um treino a dois.' },
  { text: 'Uma boa música, uma garrafa de água e siga.' },
  { text: 'Não há elevador para o sucesso. Há escadas. Literalmente, as de casa.' },
  { text: 'Faz a primeira série. As outras vêm atrás.' },
  { text: 'Disciplina é escolher o que queres mais em vez do que queres agora.' },
  { text: 'Hoje é um bom dia para ganhar XP.' },
  { text: 'O caracol também chega lá. Mas tu podes ir mais depressa.' },
  { text: 'De Caracol a Lenda, um treino de cada vez.' },
  { text: 'Ninguém se arrepende de ter treinado.' },
  { text: 'O corpo consegue. É a cabeça que tens de convencer.' },
  { text: 'Mexe-te hoje para te mexeres bem aos 80.' },
  { text: 'Não é sobre perfeição. É sobre progresso.' },
  { text: 'Às vezes o treino é só alongar. E isso também conta.' },
  { text: 'Bebe água. Eu sou um jarro, sei do que falo.' },
  { text: 'A foto no fim é a tua medalha do dia.' },
  { text: 'A passadeira não vai andar sozinha.' },
  { text: 'Os halteres estão à tua espera. Estão a ficar com saudades.' },
  { text: 'Fazer pouco é muito melhor do que não fazer nada.' },
  { text: 'O teu único adversário és tu, ontem.' },
  { text: 'Confia no processo. Os resultados aparecem.' },
  { text: 'Hoje é dia de mostrar ao jarro que não vai engordar.' },
  { text: 'Planeia a semana e a semana trata de ti.' },
  { text: 'Quem marca, cumpre. Quem cumpre, sobe no ranking.' },
  { text: 'Um treino de cada vez, uma semana de cada vez.' },
  { text: 'Não deixes que um dia falhado vire dois. Esses é que me enchem.' },
  { text: 'Descansar faz parte. Desistir não.' },
  { text: 'O aquecimento não é opcional. As tuas articulações agradecem.' },
  { text: 'Melhor feito do que perfeito.' },
  { text: 'A força não vem do que consegues fazer. Vem de ultrapassares o que achavas que não conseguias.' },
  { text: 'Hoje custa. Amanhã custa menos.' },
  { text: 'O segredo é não haver segredo: treinar, comer bem e dormir.' },
  { text: 'A preguiça é forte, mas tu és mais.' },
  { text: 'Começa onde estás. Usa o que tens. Faz o que podes.' },
  { text: 'Não esperes pela segunda-feira. Hoje também é um bom dia.' },
  { text: 'O progresso é lento, mas é progresso.' },
  { text: 'Cada repetição é um voto na pessoa que queres ser.' },
  { text: 'Os dias em que não te apetece são os que mais contam.' },
  { text: 'Hoje treinas tu. Amanhã inspiras outro lá de casa.' },
  { text: 'Se fosse fácil, toda a gente fazia. Por isso é que vale a pena.' },
  { text: 'O sofá vai continuar lá quando voltares.' },
  { text: 'Vinte minutos. É só isso que te peço.' },
  { text: 'Tu contra a gravidade. Ganha tu.' },
  { text: 'A melhor altura para treinar foi ontem. A segunda melhor é agora.' },
  { text: 'O cansaço passa. O orgulho fica.' },
  { text: 'Treina pela energia, não só pela balança.' },
  { text: 'O corpo ouve tudo o que a cabeça diz. Diz-lhe coisas boas.' },
  { text: 'Uma família que treina junta, aguenta junta.' },
  { text: 'Conquistas desbloqueiam-se a descer as escadas.' },
  { text: 'Faz hoje aquilo que o teu corpo vai agradecer amanhã.' },
  { text: 'Não é preciso ir rápido. É preciso não parar.' },
  { text: 'Uma série mal feita não conta. Faz bem, mesmo que com menos peso.' },
  { text: 'A dor de amanhã é sinal de que hoje trabalhaste.' },
  { text: 'Quem treina com um sorriso treina melhor.' },
  { text: 'Hoje és mais forte do que eras há um mês.' },
  { text: 'A sequência de semanas está nas tuas mãos.' },
  { text: 'Toca-me as vezes que quiseres. Mas depois vai treinar.' },
  { text: 'Calçar as sapatilhas já é meio treino.' },
  { text: 'Pensa no treino como um presente para ti.' },
  { text: 'Não precisas de mais tempo. Precisas de usar bem o que tens.' },
  { text: 'O primeiro passo não te leva onde queres. Tira-te de onde estás.' },
  { text: 'Hoje há mais uma oportunidade de ficar melhor.' },
  { text: 'Os campeões também começaram por ser caracóis.' },
  { text: 'Sê o motivo pelo qual alguém lá de casa também vai treinar.' },
  { text: 'O teu ritmo é o ritmo certo.' },
  { text: 'O treino de hoje é o aquecimento para a melhor versão de ti.' },
  { text: 'Não negoceies com a preguiça. Ela ganha sempre a conversa.' },
  { text: 'Treinar é a única reunião que nunca devias desmarcar.' },
  { text: 'Mais vale uma volta na passadeira do que dez voltas na cama.' },
  { text: 'Hoje fica a dever-te um treino? Então vai buscá-lo.' },
  { text: 'O equilíbrio também se treina. E o juízo também.' },
  { text: 'A tua saúde é o teu melhor investimento. E não paga multa.' },
  { text: 'Um bom treino arruma a cabeça.' },
  { text: 'Fica orgulhoso de cada dia em que apareceste.' },
  { text: 'Lento e certo, como o caracol. Mas sempre a andar.' },
  { text: 'Hoje escreves mais uma linha na tua história de Lenda.' },
]

export const QUOTES: Quote[] = [...STOICS, ...HOUSE]

const BAG_KEY = 'tec-quote-bag'

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Saco baralhado: só repete uma frase depois de saírem todas.
export function nextQuote(): Quote {
  let bag: number[] = []
  try { bag = JSON.parse(localStorage.getItem(BAG_KEY) ?? '[]') } catch { bag = [] }
  bag = bag.filter((i) => Number.isInteger(i) && i >= 0 && i < QUOTES.length)
  if (!bag.length) bag = shuffled(QUOTES.length)
  const i = bag.shift()!
  try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)) } catch { /* sem armazenamento, segue */ }
  return QUOTES[i]
}
