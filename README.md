# MTG League Scoreboard

Dashboard público para acompanhar uma liga casual de Magic: The Gathering, com ranking automático de jogadores e decks baseado em respostas de um Google Forms.

O projeto usa Google Forms, Google Sheets, Google Apps Script e React/Vite hospedado gratuitamente no GitHub Pages.

## Visão geral

O fluxo de dados funciona assim:

```text
Google Forms
↓
Google Sheets
↓
Apps Script processa os dados
↓
API JSON pública
↓
React/Vite consome a API
↓
GitHub Pages exibe o dashboard
```

## Funcionalidades

- Leaderboard de jogadores.
- Leaderboard de decks.
- Ordenação por winrate.
- Desempate por número de partidas/aparições.
- Perfis individuais de jogadores.
- Fotos, títulos e bios para jogadores.
- Perfis individuais de decks.
- Imagem do comandante, cores, bio e link da decklist.
- Cálculo de rival frequente.
- Cálculo de carrasco/nêmesis.
- Atualização automática dos dados a partir do Google Sheets.
- Hospedagem gratuita via GitHub Pages.

## Critério de ranking

Os jogadores são ordenados por:

1. Maior winrate.
2. Maior número de partidas.
3. Maior número de vitórias.
4. Nome em ordem alfabética.

Os decks são ordenados por:

1. Maior winrate.
2. Maior número de aparições.
3. Maior número de vitórias.
4. Nome em ordem alfabética.

## Tecnologias usadas

- React
- TypeScript
- Vite
- CSS
- Framer Motion
- Lucide React
- Google Sheets
- Google Apps Script
- GitHub Pages

## Estrutura do projeto

```text
mtg-league-dashboard/
├─ public/
│  ├─ favicon.svg
│  ├─ players/
│  └─ decks/
├─ src/
│  ├─ App.tsx
│  ├─ index.css
│  └─ main.tsx
├─ index.html
├─ package.json
├─ vite.config.ts
└─ README.md
```

## Configuração da API

No arquivo `src/App.tsx`, configure a URL pública do Google Apps Script:

```ts
const API_URL = "SUA_URL_DO_APPS_SCRIPT";
```

A URL precisa abrir em aba anônima sem pedir login.

Exemplo de retorno esperado:

```json
{
  "updatedAt": "05/05/2026, 10:00:00",
  "players": [
    {
      "jogador": "JBL",
      "jogos": 10,
      "vitorias": 6,
      "winrate": 0.6,
      "fotoUrl": "https://...",
      "titulo": "Prismari Enjoyer",
      "bio": "Bio do jogador",
      "rivalFrequente": {
        "nome": "Deroldo",
        "valor": 8,
        "label": "partidas juntos"
      },
      "carrasco": {
        "nome": "Pajé",
        "valor": 3,
        "label": "derrotas para"
      }
    }
  ],
  "decks": [
    {
      "deck": "Galazeth Prismari",
      "aparicoes": 8,
      "vitorias": 4,
      "winrate": 0.5,
      "fotoUrl": "https://...",
      "comandante": "Galazeth Prismari",
      "cores": "Izzet",
      "bio": "Bio do deck",
      "decklistUrl": "https://moxfield.com/..."
    }
  ]
}
```

## Abas necessárias no Google Sheets

### Aba `JOGADORES`

```text
Jogador | Foto URL | Título | Bio
```

Exemplo:

```text
JBL | https://... | Prismari Enjoyer | Especialista em fazer mana demais.
Deroldo | https://... | Mestre Linguíça | Sempre tem um topdeck suspeito.
Pajé | https://... | Indiomon Supremo | Joga quieto e vence do nada.
```

### Aba `DECKS_INFO`

```text
Deck | Foto URL | Comandante | Cores | Bio | Decklist URL
```

Exemplo:

```text
Galazeth Prismari | https://... | Galazeth Prismari | Izzet | Deck de artefatos e spellslinger. | https://moxfield.com/...
Mothman | https://... | The Wise Mothman | Sultai | Deck de rad counters e mill. | https://archidekt.com/...
```

## Imagens

Para evitar bloqueios de carregamento, recomenda-se hospedar imagens em:

- Pasta `public/` do próprio projeto.
- GitHub.
- Imgur.
- Cloudinary.
- Postimages.

Evite usar links normais do Google Drive, pois eles podem ser bloqueados pelo navegador.

Exemplo recomendado usando imagens locais:

```text
public/players/jbl.png
public/decks/galazeth.jpg
```

Na planilha, use:

```text
/mtg-league-dashboard/players/jbl.png
/mtg-league-dashboard/decks/galazeth.jpg
```

## Rodando localmente

Instale as dependências:

```bash
npm install
```

Rode o projeto localmente:

```bash
npm run dev
```

Acesse:

```text
http://localhost:5173/mtg-league-dashboard/
```

## Build

Para gerar a versão de produção:

```bash
npm run build
```

Para visualizar o build localmente:

```bash
npm run preview
```

## Deploy no GitHub Pages

Este projeto usa o pacote `gh-pages`.

Para instalar:

```bash
npm install --save-dev gh-pages
```

O `package.json` deve conter:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

O arquivo `vite.config.ts` deve conter o `base` com o nome do repositório:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/mtg-league-dashboard/',
})
```

Para publicar:

```bash
npm run deploy
```

Depois, ative o GitHub Pages no repositório:

```text
Settings → Pages → Deploy from a branch → gh-pages → /root
```

O site ficará disponível em:

```text
https://JoaoVBLaneiro.github.io/mtg-league-dashboard/
```

## Atualizando o site

Depois de alterar o código:

```bash
git add .
git commit -m "Update dashboard"
git push
npm run deploy
```

## Observações

- O dashboard atualiza os dados lendo a API do Apps Script.
- Não é necessário redeploy quando apenas novas respostas caem no Forms.
- É necessário redeploy apenas quando o código, estilos, favicon ou imagens locais forem alterados.
- Se novas respostas não aparecerem, verifique se o acionador do Apps Script está ativo.
- Se a API não carregar, teste a URL em aba anônima.
