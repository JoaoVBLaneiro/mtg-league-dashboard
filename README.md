# MTG League Dashboard — Formato Pina

Dashboard web para acompanhar uma liga casual de Commander/MTG a partir de respostas de um Google Forms. O projeto gera leaderboards automáticas de jogadores e decks, perfis interativos, estatísticas de atividade, minigames e visualizações pensadas tanto para desktop quanto para um monitor aberto na sala do projeto.

## ✨ Principais recursos

- **Leaderboard automática de jogadores e decks**
  - Ordenação por Win Rate.
  - Desempate por número de partidas/aparições.
  - Abas de período: **Geral**, **Mês** e **Semestre**.

- **Perfis de jogadores**
  - Foto, título, bio e estatísticas.
  - Ícone/símbolo do jogador via Keyrune.
  - Deck favorito definido manualmente na planilha.
  - Melhor deck calculado automaticamente por vitórias.
  - Rival frequente, carrasco e maior pato.
  - Ícone do Fblthp quando o jogador está com ele (minigame implementado).
  - Clique no símbolo do jogador para ver todos os decks daquele autor.

- **Perfis de decks**
  - Arte do comandante/carta como imagem principal.
  - Comandante, cores por mana pips e estatísticas.
  - Autor do deck com ícone clicável.
  - Origem do deck: deck fixo da salinha ou deck de fora.
  - Clique no ícone de origem para listar todos os decks daquela origem.
  - Melhor piloto calculado automaticamente.
  - Cartas chave com arte, nome e link para o Scryfall.
  - Link externo para decklist.
  - Rival frequente, carrasco e maior pato também para decks.

- **Aba de atividade**
  - Total de partidas no período.
  - Dia da semana mais ativo.
  - Horário mais ativo.
  - Jogadores mais ativos.
  - Decks mais usados.
  - Últimas partidas registradas.
  - Filtros por período: geral, semana, mês, semestre e intervalo personalizado.
  - Exportação do relatório em `.csv`.

- **Minigame do Fblthp**
  - O Fblthp começa com um jogador inicial.
  - Se o dono atual participa de uma partida e perde, o vencedor passa a carregar o Fblthp.
  - Ao trocar de dono, o Fblthp pode trocar de arte entre 5 opções.
  - Clique no ícone do Fblthp para abrir o modal explicativo do minigame.

- **Modo monitor / idle auto-scroll**
  - Em telas grandes, a página pode rolar automaticamente quando ninguém estiver mexendo.
  - Ao chegar no final, ela pausa e volta para o topo.
  - Pensado para ficar aberto em uma TV/monitor da sala.

- **Responsivo**
  - Layout adaptado para desktop, monitor grande e mobile.
  - Cards ajustados para evitar overflow em telas pequenas.

---

## 🧱 Tecnologias utilizadas

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide React](https://lucide.dev/)
- [Google Apps Script](https://developers.google.com/apps-script)
- [Google Sheets](https://www.google.com/sheets/about/)
- [GitHub Pages](https://pages.github.com/)
- [Keyrune](https://keyrune.andrewgioia.com/)
- [Scryfall](https://scryfall.com/)

---

## 📁 Estrutura geral do projeto

```txt
mtg-league-dashboard/
├─ public/
│  └─ arquivos estáticos opcionais
├─ src/
│  ├─ App.tsx
│  ├─ index.css
│  └─ main.tsx
├─ index.html
├─ package.json
├─ vite.config.ts
└─ README.md
```

---

## 📊 Estrutura esperada da planilha

O dashboard depende de algumas abas no Google Sheets.

### Aba principal de respostas

Normalmente criada automaticamente pelo Google Forms:

```txt
Respostas ao formulário 1
```

Colunas esperadas:

```txt
Carimbo de data/hora
Jogadores:
Vencedor:
Quais decks jogaram?
Quem venceu?
```

### Aba `JOGADORES`

Usada para dados manuais dos perfis dos jogadores.

Sugestão de colunas:

```txt
Jogador
Foto URL
Título
Bio
Deck Favorito
Ícone Keyrune
```

Exemplo de `Ícone Keyrune`:

```txt
ss ss-stx ss-rare ss-grad
ss ss-mh3 ss-mythic ss-grad
ss ss-cmm ss-uncommon ss-grad
```

### Aba `DECKS_INFO`

Usada para dados manuais dos perfis dos decks.

Sugestão de colunas:

```txt
Deck
Foto URL
Comandante
Cores
Bio
Decklist URL
Autor
Origem
Carta Chave 1
Arte Carta Chave 1
Scryfall Carta Chave 1
Carta Chave 2
Arte Carta Chave 2
Scryfall Carta Chave 2
Carta Chave 3
Arte Carta Chave 3
Scryfall Carta Chave 3
Carta Chave 4
Arte Carta Chave 4
Scryfall Carta Chave 4
Carta Chave 5
Arte Carta Chave 5
Scryfall Carta Chave 5
```

Valores recomendados para `Origem`:

```txt
Fixo
Fora
```

Valores aceitos para `Cores` podem ser abreviações ou nomes, por exemplo:

```txt
W
U
B
R
G
UR
WUBRG
Azorius
Dimir
Rakdos
Gruul
Selesnya
Orzhov
Izzet
Golgari
Boros
Simic
Esper
Grixis
Jund
Naya
Bant
Abzan
Jeskai
Sultai
Mardu
Temur
Incolor
```

---

## 🧙 Keyrune

O projeto usa Keyrune para símbolos de sets/expansões.

No `index.html`, inclua o CSS:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/keyrune@latest/css/keyrune.css"
/>
```

Exemplo de ícone simples:

```html
<i class="ss ss-stx"></i>
```

Exemplo com raridade e gradiente:

```html
<i class="ss ss-stx ss-rare ss-grad"></i>
```

Na planilha, basta colocar a classe completa:

```txt
ss ss-stx ss-rare ss-grad
```

---

## 🐟 Minigame do Fblthp

O Fblthp funciona como um “troféu amaldiçoado”.

Regras:

1. O Fblthp começa com um jogador inicial.
2. Se o jogador que está com o Fblthp participa de uma partida e perde, o vencedor da partida passa a ter o Fblthp.
3. Se o dono atual não estiver na partida, nada muda.
4. Quando o Fblthp troca de dono, ele pode trocar de arte entre 5 opções.
5. A arte não muda a cada refresh; ela fica vinculada à transferência.

## 🏆 Regras de ranking

### Jogadores

Ordenação:

1. Maior Win Rate.
2. Maior número de partidas.
3. Maior número de vitórias.
4. Ordem alfabética.

### Decks

Ordenação:

1. Maior Win Rate.
2. Maior número de aparições.
3. Maior número de vitórias.
4. Ordem alfabética.

---

## 🦆 Carrasco e Maior Pato

O dashboard calcula relações entre jogadores e também entre decks.

### Rival frequente

Quem mais apareceu em partidas junto com aquela pessoa/deck.

### Carrasco

Quem mais derrotou aquela pessoa/deck, desde que exista saldo negativo no confronto direto.

Exemplo:

```txt
José venceu JBL: 2 vezes
JBL venceu José: 3 vezes
```

Para José, JBL pode ser carrasco.

### Maior pato

Quem aquela pessoa/deck mais venceu, desde que exista saldo positivo no confronto direto.

Exemplo:

```txt
José venceu Pajé: 4 vezes
Pajé venceu José: 1 vez
```

Para José, Pajé pode ser maior pato.

### Saldo neutro

Se estiver empatado, não conta como carrasco nem como pato.

```txt
José venceu JBL: 2 vezes
JBL venceu José: 2 vezes
```

Nesse caso, JBL não é carrasco nem pato do José.

---

## 📈 Aba de atividade

A aba **Atividade** usa o histórico de partidas para gerar relatórios.

Ela mostra:

- Total de partidas.
- Dia mais ativo.
- Horário mais ativo.
- Jogador mais ativo.
- Deck mais usado.
- Partidas por dia da semana.
- Partidas por horário.
- Jogadores mais ativos.
- Decks mais usados.
- Últimas partidas.

Filtros disponíveis:

```txt
Geral
Semana
Mês
Semestre
Personalizado
```

Também existe o botão:

```txt
Exportar relatório
```

Ele baixa um `.csv` com o relatório do intervalo selecionado.

---
## 👑 Créditos

Projeto criado para acompanhar a liga Commander **Formato Pina** (nomeado em homenagem ao representante do TCG do projeto de extensão LUDICO da UTFPR), com integração entre Google Forms, Google Sheets, Apps Script, React e GitHub Pages.

