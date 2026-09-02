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
  - Cadastro de novos jogadores por participantes logados, com autoria auditada somente na planilha.
  - Edição de nome de exibição, título, bio, fotos e preferências.
  - Edição dos decks vinculados ao jogador, sem alterar seus identificadores.
  - Cadastro de novos decks pelo próprio jogador, com autor atribuído pela sessão.
  - Exclusão recuperável dos próprios decks, com confirmação do nome e preservação do histórico.
  - Marcador Inativo com símbolo Ice Age; decks inativos deixam de ser exigidos em Slayer e Combobreaker, mantendo vitórias históricas opcionais.
  - Consulta de jogadores que possuem cada conquista e catálogo manual com condições, raridades, progresso e IDs copiáveis.
  - Multisseleção de categorias com ícones (Aggro, Combo, Tribal, Universes Beyond e Marvel).
  - Origem Fixo da salinha/Fora editável pelo dono do deck.
  - Galeria de símbolos Keyrune com acabamento Mítico e indicação de jogadores que usam cada símbolo.
  - Busca de cartas no Scryfall para preencher nome, arte e link.
  - Busca do comandante principal e secundário pelo mesmo botão **Buscar**, preenchendo nome e foto no cadastro ou na edição de decks.
  - Galeria **Escolher arte** para selecionar edições do comandante principal, secundário e das cinco cartas-chave.
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

O autor é sempre o jogador da sessão, definido no servidor. O dono escolhe `Fixo` (salinha) ou `Fora` na origem, tanto no cadastro como na edição; `Fora` é o padrão quando nada foi informado. A origem não muda o dono nem autoriza editar decks de outras pessoas. Nenhuma estatística ou partida é criada nesse processo.

O nome identifica o deck no histórico e não pode ser renomeado pelo editor. Deve ter de 2 a 80 caracteres, sem vírgulas, quebras de linha ou prefixos de fórmula. Nomes já usados no cadastro ou no histórico são bloqueados, inclusive com diferenças de maiúsculas, acentos ou espaços. Jogadores podem usar o mesmo comandante em decks de nomes diferentes, por exemplo `Meren - Alice` e `Meren - Bob`.

O backend acrescenta automaticamente as colunas ausentes em `DECKS_INFO`, incluindo `ID de Cadastro`. Não edite esse ID: ele evita cadastrar duas vezes o mesmo envio se houver interrupção ou repetição da requisição. A interface confirma a gravação consultando o servidor, pois o POST de Apps Script usa `no-cors`.

Depois da criação, o sistema solicita atualização do catálogo/cache e sincroniza o formulário de **feedback de decks** configurado. O deck fica disponível no catálogo e no marcador de vida, mesmo sem partidas; sua entrada na leaderboard depende de partidas registradas. Se uma sincronização falhar, o deck é preservado e o jogador recebe um aviso. O administrador pode executar `updateDashboardCache` ou `syncDeckFeedbackForm`, conforme o aviso.

**Google Forms de registro de partidas:** esta atualização não muda automaticamente as alternativas desse formulário separado. Se vocês ainda registram partidas por ele, acrescente o novo nome nas perguntas de decks participantes e deck vencedor. No marcador de vida do site, os decks vêm do catálogo atualizado.

### 5. Verificação local

Com Node.js 24 e as dependências instaladas:

```bash
npm run test:deck-create
npm run test:card-search
npm run test:editor-markup
npm run test:achievements
npm run build
```

Os testes executam o backend com planilhas, sessões, locks e cache fictícios. Cobrem permissões, validações, duplicatas, histórico, reenvios, catálogo sem partidas, status, categorias, exclusão recuperável e falhas de sincronização, sem acessar contas reais. A integração com Google Apps Script e Cloudinary deve ser conferida após a publicação.

O build e os componentes novos passam na validação local. O lint geral ainda aponta nove pendências preexistentes em `App.tsx` e `LifeTracker.tsx`, fora dos trechos desta atualização.

Para testar manualmente apenas a interface, execute `npm run dev` e abra `/mtg-league-dashboard/scripts/editor-preview.html` no servidor local. Essa fixture simula jogadores, símbolos em uso, artes e cadastros, sem acessar APIs reais ou gravar na planilha; somente CSS e fontes Keyrune vêm do CDN público. Ela não entra no build de produção. A página `editor-preview-mobile.html`, no mesmo diretório, apresenta o editor em 390 pixels de largura.

### 6. Status, categorias e exclusão

Na **Área do jogador → Meus decks**, cada deck apresenta a seção **Status e categorias**.

- **Marcar como inativo / ativo:** em decks já cadastrados, o botão salva somente o status imediatamente, sem descartar outros campos em edição. Em um novo deck, o marcador é gravado ao criar. `Inativo` usa o símbolo Keyrune de **Ice Age** (`ss-ice`), em azul-claro. No modal do deck fica somente o ícone, com tooltip no hover/foco; no editor e nas listas o aviso também mantém o texto.
- **Inativos e conquistas de coleção:** os decks inativos saem tanto do total exigido quanto do progresso em **“Fulano Slayer” e “Combobreaker”**. Inativos já derrotados aparecem em **Vitórias históricas — não obrigatórias**, sem substituir vitórias pendentes contra ativos; os não derrotados ficam fora dos detalhes. Só entram como requisitos os decks ativos do autor/tipo que já participaram de partidas (a regra de participação prévia foi mantida). Sem ativos, o modal informa que não há requisitos atuais e não desbloqueia automaticamente; o histórico conquistado continua visível. Reativar volta a exigir o deck, aproveitando suas vitórias antigas. Listas, marcador de vida, rankings, partidas e conquistas que não dependem de uma coleção inteira de decks são preservados. Salvar o status atualiza o cache; ao editar a planilha diretamente, execute `updateDashboardCache`.
- **Categorias:** botões coloridos com símbolos Keyrune; é possível marcar várias ou nenhuma. Clique em **Salvar deck** ou **Criar deck** para persistir. No perfil público do deck ficam somente os ícones: hover/foco mostra o nome, e clique abre os decks daquela categoria. A lista inclui inativos e decks sem partidas; excluídos não entram. Clicar num resultado abre seu perfil; fechar mantém o perfil anterior. Os símbolos não aparecem nas listas do painel nem no seletor do marcador de vida. Os selos Inativo/Excluído continuam nas listas. No editor os nomes das categorias permanecem visíveis.
- **Excluir deck:** pede a digitação do nome e verifica o proprietário no servidor. Retira o deck da área de edição e dos catálogos de seleção após atualização do cache. Partidas, estatísticas e classificações históricas permanecem; rankings históricos podem continuar exibindo o deck com o selo `Excluído`. Não apaga imagens do Cloudinary.

**Compatibilidade das categorias:** classificações antigas nas listas `CONFIG.*DeckNames` são usadas enquanto `Categorias` estiver vazia/ausente na linha. Ao salvar uma seleção, ela passa a ser a fonte de verdade daquele deck. `[]` significa explicitamente nenhuma categoria; é diferente de uma célula vazia. As categorias são integradas às conquistas existentes, então alterá-las pode recalcular conquistas de partidas anteriores. As categorias são independentes: marcar Marvel não marca Universes Beyond automaticamente.

As novas colunas de `DECKS_INFO` são criadas automaticamente conforme necessário:

| Coluna | Uso |
| --- | --- |
| `Status` | `Ativo` (padrão) ou `Inativo`; inativos recebem Ice Age e não são exigidos em Slayer/Combobreaker |
| `Categorias` | Array JSON, como `["combo","tribal"]`; use o editor para preencher |
| `Excluído em` | Data/hora da exclusão recuperável; nunca editável pelo jogador |
| `Excluído por` | Jogador que confirmou a exclusão |
| `ID Última Alteração` | Confirmação das alterações via API; não editar manualmente |

**Recuperação administrativa:** apague somente o conteúdo das células `Excluído em` e `Excluído por` na linha do deck em `DECKS_INFO` e execute `updateDashboardCache`. Não apague a linha, as partidas nem os IDs. O nome de um deck excluído permanece reservado para não misturar históricos.

**Formulários separados:** excluir no site não apaga perguntas, opções ou respostas antigas do Google Forms de partidas/feedback. A sincronização de feedback deixa de adicionar decks excluídos, mas preserva linhas antigas. Se necessário, retire manualmente suas opções nos formulários; não use a função de reset de formulário para isso. Partidas já iniciadas no marcador de vida podem continuar sendo registradas com o deck antigo.

> O PIN é uma autenticação propositalmente superficial. Ele impede edições acidentais entre jogadores, mas não deve ser usado para dados sensíveis ou em um ambiente hostil.

### 7. Símbolos de tipos e escolha de artes

A galeria de artes usa as colunas já existentes. Porém, este pacote também inclui origem editável, símbolos e cadastro de jogadores, que **exigem publicar o novo Apps Script**, conforme a seção seguinte. Não recrie os PINs existentes.

1. Em **Meus decks**, crie ou abra um deck.
2. Digite o nome de um comandante ou carta-chave. **Buscar** escolhe a imagem padrão; **Escolher arte** abre uma galeria de edições, inclusive sem precisar buscar antes.
3. Selecione uma edição. Use **Carregar mais edições** quando houver outras páginas. Fechar a galeria ou apertar Esc mantém a escolha anterior.
4. Clique em **Salvar deck** ou **Criar deck** para gravar. Ao mudar o nome digitado, a imagem/link anteriores são limpos para não vincular a arte de outra carta.

A galeria mostra a edição, número de coleção, idioma retornado pelo Scryfall e artista. Cartas dupla face usam a frente. São exibidas as reimpressões com imagens retornadas na busca padrão do Scryfall; não há filtro de idioma nesta versão. O cache em memória dura até 10 minutos (máximo de 40 consultas), requisições idênticas em andamento são compartilhadas, e as chamadas respeitam um intervalo mínimo de 120 ms e um limite de espera de 15 segundos. As edições são carregadas apenas ao abrir a galeria e solicitar mais páginas. Falhas não apagam a seleção existente.

Validação desta atualização: 115 testes locais (incluindo renderização sem navegador, separação foto/banner, coleções ativas com histórico opcional, possuidores e catálogo manual). Também são verificados TypeScript, build e lint dos componentes do editor/metadados/consulta de conquistas. A conferência visual em navegador continua pendente por indisponibilidade do navegador de teste neste ambiente. Não foram feitas alterações ou testes de escrita na planilha publicada. O build pode emitir aviso não bloqueante de bundle principal acima de 500 kB.

As URLs selecionadas usam as colunas já existentes: `Foto URL`, `Foto Comandante Secundário`, `Arte Carta Chave N` e `Scryfall Carta Chave N`. As imagens são servidas pelo Scryfall; não passam pelo Cloudinary nem são armazenadas no Apps Script. Escolher uma edição do comandante altera **Foto URL**, exibida nas listas, prévias e retratos/cartas dos modais. **Arte URL não substitui a foto do comandante.** Alterar a edição não apaga fundos personalizados. A busca de cartas favoritas do perfil continua como antes.

| Uso da imagem | Fonte/prioridade |
| --- | --- |
| Foto do comandante nas listas e nos modais | `Foto URL` (edição escolhida no editor ou URL manual) |
| Comandante secundário | `Foto Comandante Secundário`, independente do principal |
| Banners/capas dos decks | `Header URL` → `Arte URL` → `Foto URL` |
| Fundo do deck no marcador de vida | `Arte URL` → `Foto URL` |
| Cartas-chave | `Arte Carta Chave N`, conforme a edição escolhida |

Depois de **Salvar deck**, ao voltar ao dashboard os dados são carregados novamente. Uma aba já aberta pode usar o botão **Atualizar** ou aguardar a atualização periódica. Não é preciso limpar `Arte URL` para ver a nova foto. Partidas já iniciadas no marcador de vida mantêm a imagem selecionada no início.

Os símbolos representam os tipos visualmente, sem alterar suas regras:

| Tipo | Set Keyrune | Classe |
| --- | --- | --- |
| Aggro | Fate Reforged | `ss-frf` |
| Combo | Urza’s Saga | `ss-usg` |
| Tribal | Lorwyn | `ss-lrw` |
| Universes Beyond | The Lord of the Rings | `ss-ltr` |
| Marvel | Marvel’s Spider-Man | `ss-spm` |
| Inativo (status) | Ice Age | `ss-ice` |

Referências: [ícones Keyrune](https://keyrune.andrewgioia.com/icons.html), [busca de edições Scryfall](https://scryfall.com/docs/api/cards/search).

### 8. Símbolos pessoais e cadastro de jogadores

**Atualização necessária:** substitua o código do Apps Script pelo `backend/Code.gs` (ou TXT desta entrega), salve e publique uma **nova versão da implantação existente**, preservando a URL. Execute `updateDashboardCache` uma vez para recalcular Slayer/Combobreaker e publicar o catálogo global de conquistas. Depois atualize o frontend e saia/entre novamente no editor. Não é necessário executar `setupPlayerEditorAccess`, recriar PINs, instalar gatilhos ou configurar Cloudinary novamente. Campos novos são criados automaticamente ao salvar/cadastrar.

Em **Meu perfil → Identidade**, use **Seu símbolo Keyrune → Escolher símbolo**. Em Preferências também há um seletor para o set favorito. A galeria permite buscar nome/código, mostra o acabamento Mítico e identifica quem já usa cada símbolo como identidade pessoal. Repetições são permitidas, apenas sinalizadas. A lista incluída abre imediatamente; o CSS oficial completa os demais códigos quando disponível. Salve o perfil para aplicar. Símbolos antigos válidos também são apresentados como Míticos nos dados públicos após atualização do cache, sem reescrever todas as células antigas.

Em **Cadastrar jogador**, abaixo de **Acesso**, informe um nome/identificador único, nome de exibição opcional e símbolo. O cadastro exige uma sessão de um jogador que ainda exista em `JOGADORES`, inclusive ao chamar a API diretamente. O servidor define a autoria pela sessão e ignora tentativas de informar outro autor.

O navegador gera o PIN inicial de seis dígitos e o envia somente no POST autenticado. Ele é mostrado ao cadastrante após confirmação, para compartilhar com o novo jogador. Guarde-o antes de sair/recarregar; ele não é persistido no navegador nem devolvido nas respostas de status. O novo jogador pode entrar e alterá-lo em Acesso. Os PINs anteriores não são modificados.

| Coluna em `JOGADORES` | Uso |
| --- | --- |
| `Jogador` | Identificador histórico do novo participante |
| `Nome de Exibição` | Nome público editável |
| `Ícone Keyrune` | Símbolo pessoal, normalizado para Mítico |
| `PIN de Edição` | PIN individual; nunca incluído no JSON público |
| `Cadastrado por` | Jogador da sessão que fez o cadastro; somente planilha |
| `Cadastrado em` | Data/hora ISO do cadastro; somente planilha |
| `ID de Cadastro` | Identificador privado contra envios duplicados |

A autoria/data/ID não são enviados aos perfis, catálogo, leaderboard nem ao editor. Repetir o envio não duplica a pessoa nem altera seu PIN. Nomes existentes no cadastro ou histórico são reservados; recuperar uma pessoa antiga requer intervenção administrativa. Jogadores sem partidas aparecem no catálogo de acesso, mas não ganham estatísticas fictícias. O cadastro solicita atualização do cache; se ela falhar, preserva a pessoa e informa que a administração deve executar `updateDashboardCache`. Formulários externos de registro de partidas não têm suas opções de jogadores alteradas automaticamente.

### 9. Consulta de conquistas e catálogo manual

- **Quem possui:** abra qualquer conquista e expanda **Ver jogadores que possuem**. A lista usa o ID interno exato e somente `unlocked: true`, mostrando nome e raridade atingida. Ter algum progresso abaixo do primeiro requisito não conta como possuir. O resumo vem da liga inteira, incluindo pessoas sem partidas recentes/fora do ranking do período; a ordem é por raridade e nome. Abrir a lista não faz outra requisição.
- **Catálogo:** botão **Conquistas manuais** no topo do painel, ou **Catálogo de conquistas manuais** na seção de conquistas de um perfil. Selecione o jogador, busque por nome/condição/ID e filtre Todas, Desbloqueadas ou Pendentes. O acesso pelo perfil já seleciona aquele jogador.
- **Conteúdo:** todas as definições de `buildManualAchievementCatalog`, inclusive as nunca concedidas; descrição da condição, quantidade exigida por raridade, número de registros do jogador, estado atual e ID interno com botão de copiar. **Ver detalhes e jogadores** abre a conquista por cima do catálogo; fechar volta à consulta. Sem jogador escolhido, os detalhes são identificados como prévia do catálogo.
- **Só consulta:** nenhum botão concede ou revoga conquistas. A administração continua usando a aba `CONQUISTAS_MANUAIS`, com as colunas existentes `Jogador`, `ID`, `Valor`, `Data` e `Observação`. As condições/raridades são as definidas no código, sem alterações nesta entrega. Após registrar manualmente uma concessão, atualize o cache para ela aparecer.
- **Dados:** `achievementDirectory` contém definições e resumos globais, sem PINs, autoria de cadastros, notas de concessão nem evidências completas duplicadas. Se a implantação/cache forem antigos, a interface pede atualização em vez de apresentar uma lista incompleta como definitiva.
- **Escopo da inatividade:** uma função compartilhada calcula os requisitos ativos e as vitórias históricas opcionais de Slayer e Combobreaker, as coleções de derrota de decks existentes hoje. Conquistas por mesa, cores, número de partidas, vitórias ou jogadores não são filtradas por inatividade.

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
