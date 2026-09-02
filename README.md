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

- **Área do jogador**
  - Entrada individual por jogador e PIN numérico.
  - Edição de nome de exibição, título, bio, fotos e preferências.
  - Edição dos decks vinculados ao jogador, sem alterar seus identificadores.
  - Cadastro de novos decks pelo próprio jogador, com autor atribuído pela sessão.
  - Exclusão recuperável dos próprios decks, com confirmação do nome e preservação do histórico.
  - Marcador Ativo/Inativo e multisseleção de categorias com ícones (Aggro, Combo, Tribal, Universes Beyond e Marvel).
  - Busca de cartas no Scryfall para preencher nome, arte e link.
  - Busca do comandante principal e secundário pelo mesmo botão **Buscar**, preenchendo nome e foto no cadastro ou na edição de decks.
  - Upload direto para o Cloudinary, com redução da imagem no navegador.

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
- [Cloudinary](https://cloudinary.com/)

---

## 📁 Estrutura geral do projeto

```txt
mtg-league-dashboard/
├─ public/
│  └─ arquivos estáticos opcionais
├─ src/
│  ├─ App.tsx
│  ├─ PlayerEditor.tsx
│  ├─ playerEditor.css
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
Nome de Exibição
PIN de Edição
Foto URL
Header URL
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

## 🔐 Área do jogador

O editor foi pensado como uma camada de conveniência para uma liga entre pessoas conhecidas. O identificador da planilha continua imutável; o campo `Nome de Exibição` pode ser alterado sem quebrar partidas ou estatísticas antigas.

### 1. Criar os PINs

Depois de colar e salvar a versão atualizada do Apps Script, recarregue a planilha e use:

```txt
MTG Dashboard → Configurar área dos jogadores
```

O comando cria as colunas ausentes e gera um PIN de 6 dígitos para cada jogador que ainda não possui um. Distribua cada PIN apenas para o respectivo jogador. O próprio jogador poderá trocá-lo pela interface.

Também é possível selecionar `setupPlayerEditorAccess` no editor do Apps Script e clicar em **Executar**. A confirmação dessa função usa o registro de execução, sem depender de uma janela na planilha. Se os PINs já existem, não é necessário recriá-los para esta atualização.

### 2. Configurar o upload de imagens

No Cloudinary, crie um **unsigned upload preset**. Para este projeto, recomenda-se limitar o preset a imagens, habilitar apenas formatos como JPG, PNG e WebP e definir uma pasta exclusiva para a liga.

Na planilha, use:

```txt
MTG Dashboard → Configurar Cloudinary do editor
```

Informe o `Cloud Name` e o nome do unsigned upload preset. Esses valores não são senhas: ficam públicos no navegador por exigência do upload direto. Enquanto essa configuração não for feita, o editor continua aceitando URLs de imagem coladas manualmente.

Nesta versão, `CONFIG.cloudinaryCloudName` e `CONFIG.cloudinaryUploadPreset` já vêm preenchidos com `t0rjiyla` e `mtg_jogadores`. Caso o menu não esteja disponível, esses campos podem ser configurados diretamente no início do Apps Script. Propriedades salvas pelo menu, quando existentes, têm prioridade sobre o `CONFIG`.

### 3. Publicar

O backend completo está em `backend/Code.gs` (mesmo conteúdo do TXT entregue separadamente). Copie-o para o projeto Apps Script existente e salve. Antes de substituir, guarde uma cópia do seu código atual se tiver feito alterações adicionais.

No Apps Script, use **Implantar → Gerenciar implantações → Editar (lápis) → Versão: Nova versão → Implantar**. Atualize a implantação existente para manter a URL atual; não é preciso gerar PINs novamente. Depois, atualize os arquivos do frontend no seu repositório e publique pelo processo habitual do GitHub Pages.

Se optar por outra URL de implantação, atualize-a nos três arquivos: `src/App.tsx`, `src/LifeTracker.tsx` e `src/PlayerEditor.tsx`. Publique o backend antes do frontend: o botão de cadastro precisa das novas ações da API.

### 4. Cadastrar um deck

1. Entre com seu jogador e PIN na **Área do jogador**.
2. Abra **Meus decks → Novo deck**.
3. Informe um nome único e o comandante. Cores, bio, fotos, decklist, bracket e cartas-chave são opcionais.
4. Clique em **Criar deck** e aguarde a confirmação. O novo deck será aberto para continuar editando.

Nos campos **Comandante** e **Comandante secundário**, digite o nome da carta e clique em **Buscar** (ou pressione Enter). A mesma busca usada nas cartas favoritas e cartas-chave preenche o nome oficial e a foto, com prévia da carta. Aguarde a busca terminar antes de criar/salvar o deck. O nome do deck, as cores, a arte personalizada e a capa não são alterados; fotos também continuam editáveis manualmente na seção de imagens. Se a carta não for encontrada, o campo mostra o erro sem apagar os dados anteriores.

**Esta versão de gerenciamento de decks exige atualizar o Apps Script e o frontend.** Não é necessário recriar PINs nem reconfigurar o Cloudinary. Publique primeiro uma nova versão da implantação existente do Apps Script, mantendo sua URL, e depois publique o frontend atualizado.

O autor é sempre o jogador da sessão, definido no servidor. Novos decks pessoais entram como `Fora`; somente a administração da planilha pode classificá-los como `Fixo`. Nenhuma estatística ou partida é criada nesse processo.

O nome identifica o deck no histórico e não pode ser renomeado pelo editor. Deve ter de 2 a 80 caracteres, sem vírgulas, quebras de linha ou prefixos de fórmula. Nomes já usados no cadastro ou no histórico são bloqueados, inclusive com diferenças de maiúsculas, acentos ou espaços. Jogadores podem usar o mesmo comandante em decks de nomes diferentes, por exemplo `Meren - Alice` e `Meren - Bob`.

O backend acrescenta automaticamente as colunas ausentes em `DECKS_INFO`, incluindo `ID de Cadastro`. Não edite esse ID: ele evita cadastrar duas vezes o mesmo envio se houver interrupção ou repetição da requisição. A interface confirma a gravação consultando o servidor, pois o POST de Apps Script usa `no-cors`.

Depois da criação, o sistema solicita atualização do catálogo/cache e sincroniza o formulário de **feedback de decks** configurado. O deck fica disponível no catálogo e no marcador de vida, mesmo sem partidas; sua entrada na leaderboard depende de partidas registradas. Se uma sincronização falhar, o deck é preservado e o jogador recebe um aviso. O administrador pode executar `updateDashboardCache` ou `syncDeckFeedbackForm`, conforme o aviso.

**Google Forms de registro de partidas:** esta atualização não muda automaticamente as alternativas desse formulário separado. Se vocês ainda registram partidas por ele, acrescente o novo nome nas perguntas de decks participantes e deck vencedor. No marcador de vida do site, os decks vêm do catálogo atualizado.

### 5. Verificação local

Com Node.js 24 e as dependências instaladas:

```bash
npm run test:deck-create
npm run test:card-search
npm run build
```

Os testes executam o backend com planilhas, sessões, locks e cache fictícios. Cobrem permissões, validações, duplicatas, histórico, reenvios, catálogo sem partidas, status, categorias, exclusão recuperável e falhas de sincronização, sem acessar contas reais. A integração com Google Apps Script e Cloudinary deve ser conferida após a publicação.

O build e os componentes novos passam na validação local. O lint geral ainda aponta nove pendências preexistentes em `App.tsx` e `LifeTracker.tsx`, fora dos trechos desta atualização.

Para testar manualmente apenas a interface, execute `npm run dev` e abra `/mtg-league-dashboard/scripts/editor-preview.html` no servidor local. Essa fixture usa dados fictícios e bloqueia acessos externos; não entra no build de produção. A página `editor-preview-mobile.html`, no mesmo diretório, apresenta o editor em 390 pixels de largura.

### 6. Status, categorias e exclusão

Na **Área do jogador → Meus decks**, cada deck apresenta a seção **Status e categorias**.

- **Marcar como inativo / ativo:** em decks já cadastrados, o botão salva somente o status imediatamente, sem descartar outros campos em edição. Em um novo deck, o marcador é gravado ao criar. Por enquanto, `Inativo` é apenas visual: não esconde, não bloqueia seleção no marcador de vida e não modifica estatísticas nem conquistas.
- **Categorias:** botões coloridos com símbolos; é possível marcar várias ou nenhuma. Clique em **Salvar deck** ou **Criar deck** para persistir. Os ícones também aparecem nos perfis públicos, no catálogo e no seletor de decks do marcador de vida.
- **Excluir deck:** pede a digitação do nome e verifica o proprietário no servidor. Retira o deck da área de edição e dos catálogos de seleção após atualização do cache. Partidas, estatísticas e classificações históricas permanecem; rankings históricos podem continuar exibindo o deck com o selo `Excluído`. Não apaga imagens do Cloudinary.

**Compatibilidade das categorias:** classificações antigas nas listas `CONFIG.*DeckNames` são usadas enquanto `Categorias` estiver vazia/ausente na linha. Ao salvar uma seleção, ela passa a ser a fonte de verdade daquele deck. `[]` significa explicitamente nenhuma categoria; é diferente de uma célula vazia. As categorias são integradas às conquistas existentes, então alterá-las pode recalcular conquistas de partidas anteriores. As categorias são independentes: marcar Marvel não marca Universes Beyond automaticamente.

As novas colunas de `DECKS_INFO` são criadas automaticamente conforme necessário:

| Coluna | Uso |
| --- | --- |
| `Status` | `Ativo` (padrão) ou `Inativo`; apenas marcador |
| `Categorias` | Array JSON, como `["combo","tribal"]`; use o editor para preencher |
| `Excluído em` | Data/hora da exclusão recuperável; nunca editável pelo jogador |
| `Excluído por` | Jogador que confirmou a exclusão |
| `ID Última Alteração` | Confirmação das alterações via API; não editar manualmente |

**Recuperação administrativa:** apague somente o conteúdo das células `Excluído em` e `Excluído por` na linha do deck em `DECKS_INFO` e execute `updateDashboardCache`. Não apague a linha, as partidas nem os IDs. O nome de um deck excluído permanece reservado para não misturar históricos.

**Formulários separados:** excluir no site não apaga perguntas, opções ou respostas antigas do Google Forms de partidas/feedback. A sincronização de feedback deixa de adicionar decks excluídos, mas preserva linhas antigas. Se necessário, retire manualmente suas opções nos formulários; não use a função de reset de formulário para isso. Partidas já iniciadas no marcador de vida podem continuar sendo registradas com o deck antigo.

> O PIN é uma autenticação propositalmente superficial. Ele impede edições acidentais entre jogadores, mas não deve ser usado para dados sensíveis ou em um ambiente hostil.

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
