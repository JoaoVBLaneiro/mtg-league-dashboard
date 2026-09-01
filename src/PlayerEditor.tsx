import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  ImageUp,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Save,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  Wand2,
} from "lucide-react";
import "./playerEditor.css";

const API_URL =
  "https://script.google.com/macros/s/AKfycbwureAMUuD7InHeJL72eailwyiYe-tafREBax46DTpqG4yNPnMrcs_ZGTQluvh-csNi/exec";

const SESSION_STORAGE_KEY = "mtg-player-editor-session";

type EditorFields = Record<string, string | number | null>;

type EditorDeck = {
  id: string;
  fields: EditorFields;
};

type EditorSessionData = {
  player: {
    id: string;
    fields: EditorFields;
  };
  decks: EditorDeck[];
  cloudinary: {
    cloudName: string;
    uploadPreset: string;
  };
  sessionSeconds: number;
};

type EditorApiResponse = {
  ok?: boolean;
  error?: string;
  token?: string;
  data?: EditorSessionData;
};

type PublicPlayer = {
  id: string;
  label: string;
};

type PublicDashboardPlayer = {
  jogador?: string;
  player?: string;
  nome?: string;
  nomeExibicao?: string;
};

type PublicDashboardDeck = {
  deck?: string;
  nome?: string;
};

type PublicDashboardResponse = {
  catalog?: {
    players?: PublicDashboardPlayer[];
    decks?: PublicDashboardDeck[];
  };
  leaderboards?: {
    geral?: {
      players?: PublicDashboardPlayer[];
      decks?: PublicDashboardDeck[];
    };
  };
};

type CloudinaryConfig = EditorSessionData["cloudinary"];

type ScryfallCard = {
  name?: string;
  scryfall_uri?: string;
  image_uris?: {
    normal?: string;
    large?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      normal?: string;
      large?: string;
    };
  }>;
  details?: string;
};

function stringValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/^Error:\s*/i, "");
  }

  return "Ocorreu um erro inesperado.";
}

function editorApiUrl(parameters: Record<string, string>) {
  const query = new URLSearchParams({
    ...parameters,
    t: String(Date.now()),
  });

  return `${API_URL}?${query.toString()}`;
}

async function readJsonResponse(response: Response) {
  const json = (await response.json()) as EditorApiResponse;

  if (!response.ok || json.ok === false || json.error) {
    throw new Error(json.error || "Não foi possível concluir a solicitação.");
  }

  return json;
}

async function requestEditorSession(currentToken: string) {
  const response = await fetch(
    editorApiUrl({ action: "editorSession", token: currentToken })
  );
  const json = await readJsonResponse(response);

  if (!json.data) {
    throw new Error("O backend não retornou os dados do editor.");
  }

  return json.data;
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      image.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error("A imagem deve possuir no máximo 12 MB.");
  }

  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  const image = await loadImageElement(file);
  const maxDimension = 1600;
  const scale = Math.min(
    1,
    maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.86);
  });

  return blob || file;
}

async function uploadImageToCloudinary(
  file: File,
  config: CloudinaryConfig
) {
  if (!config.cloudName || !config.uploadPreset) {
    throw new Error(
      "O upload ainda não foi configurado pelo administrador. Cole uma URL manualmente por enquanto."
    );
  }

  const preparedFile = await prepareImageForUpload(file);
  const body = new FormData();
  const uploadFileName = preparedFile === file
    ? file.name
    : file.name.replace(/\.[^.]+$/, ".webp");
  body.append("file", preparedFile, uploadFileName);
  body.append("upload_preset", config.uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      config.cloudName
    )}/image/upload`,
    {
      method: "POST",
      body,
    }
  );

  const result = (await response.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !result.secure_url) {
    throw new Error(
      result.error?.message || "Não foi possível enviar a imagem."
    );
  }

  return result.secure_url;
}

async function findCardOnScryfall(cardName: string) {
  const cleanName = cardName.trim();

  if (!cleanName) {
    throw new Error("Informe o nome da carta primeiro.");
  }

  const response = await fetch(
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cleanName)}`
  );
  const card = (await response.json()) as ScryfallCard;

  if (!response.ok) {
    throw new Error(card.details || "Carta não encontrada no Scryfall.");
  }

  const imageUrl =
    card.image_uris?.large ||
    card.image_uris?.normal ||
    card.card_faces?.[0]?.image_uris?.large ||
    card.card_faces?.[0]?.image_uris?.normal ||
    "";

  return {
    name: card.name || cleanName,
    imageUrl,
    scryfallUrl: card.scryfall_uri || "",
  };
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
  list,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: "text" | "url" | "number";
  readOnly?: boolean;
  list?: string;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        list={list}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="editor-field editor-field-wide">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </label>
  );
}

function ImageUrlField({
  label,
  value,
  onChange,
  cloudinary,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  cloudinary: CloudinaryConfig;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;

    try {
      setUploading(true);
      setError("");
      const url = await uploadImageToCloudinary(file, cloudinary);
      onChange(url);
    } catch (uploadError) {
      setError(normalizeErrorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="editor-field editor-image-field">
      <span>{label}</span>

      <div className="editor-image-field-main">
        <div className="editor-image-preview">
          {value ? (
            <img src={value} alt={`Prévia de ${label}`} />
          ) : (
            <Camera size={24} />
          )}
        </div>

        <div className="editor-image-controls">
          <input
            type="url"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://..."
          />

          <label
            className={
              cloudinary.cloudName && cloudinary.uploadPreset
                ? "editor-upload-button"
                : "editor-upload-button editor-upload-button-disabled"
            }
          >
            {uploading ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <ImageUp size={17} />
            )}
            {uploading ? "Enviando..." : "Escolher imagem"}
            <input
              type="file"
              accept="image/*"
              disabled={uploading || !cloudinary.cloudName || !cloudinary.uploadPreset}
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {!cloudinary.cloudName || !cloudinary.uploadPreset ? (
        <small>Upload automático ainda não configurado; a URL manual continua disponível.</small>
      ) : null}

      {error ? <small className="editor-field-error">{error}</small> : null}
    </div>
  );
}

function CardLookupFields({
  label,
  nameField,
  imageField,
  linkField,
  fields,
  onChange,
}: {
  label: string;
  nameField: string;
  imageField: string;
  linkField: string;
  fields: EditorFields;
  onChange: (field: string, value: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const name = stringValue(fields[nameField]);
  const imageUrl = stringValue(fields[imageField]);

  async function resolveCard() {
    try {
      setLoading(true);
      setError("");
      const card = await findCardOnScryfall(name);
      onChange(nameField, card.name);
      onChange(imageField, card.imageUrl);
      onChange(linkField, card.scryfallUrl);
    } catch (lookupError) {
      setError(normalizeErrorMessage(lookupError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="editor-card-lookup">
      <div className="editor-card-lookup-image">
        {imageUrl ? <img src={imageUrl} alt={name || label} /> : <Wand2 size={25} />}
      </div>

      <div className="editor-card-lookup-fields">
        <span>{label}</span>
        <div className="editor-card-name-row">
          <input
            value={name}
            onChange={(event) => onChange(nameField, event.target.value)}
            placeholder="Nome da carta"
          />
          <button type="button" onClick={() => void resolveCard()} disabled={loading}>
            {loading ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
            Buscar
          </button>
        </div>
        {error ? <small className="editor-field-error">{error}</small> : null}
      </div>
    </div>
  );
}

function EditorNotice({
  kind,
  children,
}: {
  kind: "success" | "error" | "info";
  children: React.ReactNode;
}) {
  return (
    <div className={`editor-notice editor-notice-${kind}`}>
      {kind === "success" ? (
        <CheckCircle2 size={19} />
      ) : kind === "error" ? (
        <AlertTriangle size={19} />
      ) : (
        <ShieldCheck size={19} />
      )}
      <span>{children}</span>
    </div>
  );
}

export default function PlayerEditorApp() {
  const [publicPlayers, setPublicPlayers] = useState<PublicPlayer[]>([]);
  const [publicDecks, setPublicDecks] = useState<string[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loginLoading, setLoginLoading] = useState(
    () => Boolean(localStorage.getItem(SESSION_STORAGE_KEY))
  );
  const [loginError, setLoginError] = useState("");

  const [token, setToken] = useState("");
  const [sessionData, setSessionData] = useState<EditorSessionData | null>(null);
  const [profileFields, setProfileFields] = useState<EditorFields>({});
  const [deckFields, setDeckFields] = useState<Record<string, EditorFields>>({});
  const [activeSection, setActiveSection] = useState<"profile" | "decks" | "access">(
    "profile"
  );
  const [activeDeckId, setActiveDeckId] = useState("");
  const [savingTarget, setSavingTarget] = useState("");
  const [notice, setNotice] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [nextPin, setNextPin] = useState("");
  const [confirmNextPin, setConfirmNextPin] = useState("");

  const activeDeck = useMemo(
    () => sessionData?.decks.find((deck) => deck.id === activeDeckId) || null,
    [sessionData?.decks, activeDeckId]
  );

  function applySessionData(data: EditorSessionData) {
    setSessionData(data);
    setProfileFields({ ...data.player.fields });
    setDeckFields(
      Object.fromEntries(
        data.decks.map((deck) => [deck.id, { ...deck.fields }])
      )
    );
    setActiveDeckId((current) =>
      data.decks.some((deck) => deck.id === current)
        ? current
        : data.decks[0]?.id || ""
    );
  }

  async function fetchSession(currentToken: string) {
    const data = await requestEditorSession(currentToken);
    applySessionData(data);
    return data;
  }

  useEffect(() => {
    async function loadDirectory() {
      try {
        setDirectoryLoading(true);
        const response = await fetch(`${API_URL}?t=${Date.now()}`);

        if (!response.ok) {
          throw new Error("Não foi possível carregar os jogadores.");
        }

        const data = (await response.json()) as PublicDashboardResponse;
        const playerSource =
          data.catalog?.players || data.leaderboards?.geral?.players || [];
        const deckSource =
          data.catalog?.decks || data.leaderboards?.geral?.decks || [];

        const players = playerSource
          .map((player) => {
            const id = String(
              player.jogador || player.player || player.nome || ""
            ).trim();

            return {
              id,
              label: String(player.nomeExibicao || id).trim(),
            };
          })
          .filter((player) => player.id)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        const decks = deckSource
          .map((deck) => String(deck.deck || deck.nome || "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "pt-BR"));

        setPublicPlayers(players);
        setPublicDecks(Array.from(new Set(decks)));
      } catch (error) {
        setLoginError(normalizeErrorMessage(error));
      } finally {
        setDirectoryLoading(false);
      }
    }

    void loadDirectory();
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(SESSION_STORAGE_KEY) || "";

    if (!storedToken) return;

    void requestEditorSession(storedToken)
      .then((data) => {
        setSessionData(data);
        setProfileFields({ ...data.player.fields });
        setDeckFields(
          Object.fromEntries(
            data.decks.map((deck) => [deck.id, { ...deck.fields }])
          )
        );
        setActiveDeckId(data.decks[0]?.id || "");
        setToken(storedToken);
      })
      .catch(() => localStorage.removeItem(SESSION_STORAGE_KEY))
      .finally(() => setLoginLoading(false));
  }, []);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedPlayer || !pin) {
      setLoginError("Selecione o jogador e informe o PIN.");
      return;
    }

    try {
      setLoginLoading(true);
      setLoginError("");
      const response = await fetch(
        editorApiUrl({
          action: "editorLogin",
          player: selectedPlayer,
          pin,
        })
      );
      const json = await readJsonResponse(response);

      if (!json.token || !json.data) {
        throw new Error("Não foi possível iniciar a sessão.");
      }

      localStorage.setItem(SESSION_STORAGE_KEY, json.token);
      setToken(json.token);
      setPin("");
      applySessionData(json.data);
    } catch (error) {
      setLoginError(normalizeErrorMessage(error));
    } finally {
      setLoginLoading(false);
    }
  }

  async function sendEditorAction(
    action: "editorUpdateProfile" | "editorUpdateDeck" | "editorUpdatePin",
    payload: Record<string, unknown>
  ) {
    if (!token) {
      throw new Error("Sua sessão expirou. Entre novamente.");
    }

    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action,
        token,
        ...payload,
      }),
    });
  }

  function updateProfileField(field: string, value: string) {
    setProfileFields((current) => ({ ...current, [field]: value }));
  }

  function updateDeckField(deckId: string, field: string, value: string) {
    setDeckFields((current) => ({
      ...current,
      [deckId]: {
        ...(current[deckId] || {}),
        [field]: value,
      },
    }));
  }

  async function saveProfile() {
    try {
      setSavingTarget("profile");
      setNotice(null);
      await sendEditorAction("editorUpdateProfile", { fields: profileFields });
      await fetchSession(token);
      setNotice({ kind: "success", text: "Perfil salvo e dashboard atualizado." });
    } catch (error) {
      setNotice({ kind: "error", text: normalizeErrorMessage(error) });
    } finally {
      setSavingTarget("");
    }
  }

  async function saveDeck(deckId: string) {
    try {
      setSavingTarget(`deck:${deckId}`);
      setNotice(null);
      await sendEditorAction("editorUpdateDeck", {
        deckId,
        fields: deckFields[deckId] || {},
      });
      await fetchSession(token);
      setNotice({ kind: "success", text: `Deck ${deckId} salvo com sucesso.` });
    } catch (error) {
      setNotice({ kind: "error", text: normalizeErrorMessage(error) });
    } finally {
      setSavingTarget("");
    }
  }

  async function changePin() {
    if (!/^\d{4,8}$/.test(nextPin)) {
      setNotice({ kind: "error", text: "O novo PIN deve possuir de 4 a 8 números." });
      return;
    }

    if (nextPin !== confirmNextPin) {
      setNotice({ kind: "error", text: "A confirmação do PIN não coincide." });
      return;
    }

    if (!sessionData) return;

    try {
      setSavingTarget("pin");
      setNotice(null);
      await sendEditorAction("editorUpdatePin", { nextPin });

      const response = await fetch(
        editorApiUrl({
          action: "editorLogin",
          player: sessionData.player.id,
          pin: nextPin,
        })
      );
      const json = await readJsonResponse(response);

      if (!json.token || !json.data) {
        throw new Error("O novo PIN não pôde ser confirmado.");
      }

      localStorage.setItem(SESSION_STORAGE_KEY, json.token);
      setToken(json.token);
      applySessionData(json.data);
      setNextPin("");
      setConfirmNextPin("");
      setNotice({ kind: "success", text: "PIN atualizado com sucesso." });
    } catch (error) {
      setNotice({ kind: "error", text: normalizeErrorMessage(error) });
    } finally {
      setSavingTarget("");
    }
  }

  function logout() {
    if (token) {
      void fetch(editorApiUrl({ action: "editorLogout", token })).catch(() => undefined);
    }

    localStorage.removeItem(SESSION_STORAGE_KEY);
    setToken("");
    setSessionData(null);
    setProfileFields({});
    setDeckFields({});
    setNotice(null);
  }

  if (!sessionData) {
    return (
      <main className="player-editor-page player-editor-login-page">
        <a className="editor-back-link" href="#">
          <ArrowLeft size={17} />
          Voltar ao dashboard
        </a>

        <section className="editor-login-card">
          <div className="editor-login-icon">
            <UserRoundCog size={34} />
          </div>

          <div className="editor-login-heading">
            <span>Formato Pina</span>
            <h1>Área do Jogador</h1>
            <p>Edite seu perfil e os decks cadastrados em seu nome.</p>
          </div>

          <form onSubmit={handleLogin} className="editor-login-form">
            <label className="editor-field">
              <span>Jogador</span>
              <select
                value={selectedPlayer}
                onChange={(event) => setSelectedPlayer(event.target.value)}
                disabled={directoryLoading}
              >
                <option value="">
                  {directoryLoading ? "Carregando jogadores..." : "Selecione seu nome"}
                </option>
                {publicPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="editor-field">
              <span>PIN individual</span>
              <div className="editor-pin-input">
                <input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Seu PIN"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPin((current) => !current)}>
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {loginError ? <EditorNotice kind="error">{loginError}</EditorNotice> : null}

            <button className="editor-primary-button" type="submit" disabled={loginLoading}>
              {loginLoading ? <LoaderCircle size={19} className="spin" /> : <LogIn size={19} />}
              {loginLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="editor-login-footnote">
            <ShieldCheck size={18} />
            <p>
              Este acesso é apenas uma proteção leve para a liga. Não utilize o mesmo PIN de contas importantes.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const cloudinary = sessionData.cloudinary;
  const currentDeckFields = activeDeck ? deckFields[activeDeck.id] || {} : {};

  return (
    <main className="player-editor-page">
      <header className="editor-topbar">
        <a className="editor-brand" href="#">
          <UserRoundCog size={25} />
          <span>
            <small>Formato Pina</small>
            <strong>Área do Jogador</strong>
          </span>
        </a>

        <div className="editor-session-user">
          <span>Conectado como</span>
          <strong>
            {stringValue(profileFields["Nome de Exibição"]) || sessionData.player.id}
          </strong>
          <button type="button" onClick={logout}>
            <LogOut size={17} />
            Sair
          </button>
        </div>
      </header>

      <div className="editor-shell">
        <aside className="editor-sidebar">
          <button
            className={activeSection === "profile" ? "active" : ""}
            type="button"
            onClick={() => setActiveSection("profile")}
          >
            <UserRoundCog size={19} />
            Meu perfil
          </button>

          <button
            className={activeSection === "decks" ? "active" : ""}
            type="button"
            onClick={() => setActiveSection("decks")}
          >
            <BookOpen size={19} />
            Meus decks
            <span>{sessionData.decks.length}</span>
          </button>

          <button
            className={activeSection === "access" ? "active" : ""}
            type="button"
            onClick={() => setActiveSection("access")}
          >
            <KeyRound size={19} />
            Acesso
          </button>

          <a href="#">
            <ArrowLeft size={19} />
            Dashboard
          </a>
        </aside>

        <section className="editor-content">
          {notice ? <EditorNotice kind={notice.kind}>{notice.text}</EditorNotice> : null}

          {activeSection === "profile" ? (
            <>
              <div className="editor-page-heading">
                <div>
                  <span>Perfil público</span>
                  <h1>Minhas informações</h1>
                  <p>As alterações aparecerão no dashboard após o salvamento.</p>
                </div>

                <button
                  className="editor-primary-button editor-save-button"
                  type="button"
                  onClick={() => void saveProfile()}
                  disabled={savingTarget === "profile"}
                >
                  {savingTarget === "profile" ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {savingTarget === "profile" ? "Salvando..." : "Salvar perfil"}
                </button>
              </div>

              <div className="editor-form-section">
                <div className="editor-section-heading">
                  <h2>Identidade</h2>
                  <p>O identificador histórico não pode ser alterado pela interface.</p>
                </div>

                <div className="editor-form-grid">
                  <TextField label="Identificador interno" value={sessionData.player.id} readOnly />
                  <TextField
                    label="Nome de exibição"
                    value={stringValue(profileFields["Nome de Exibição"])}
                    onChange={(value) => updateProfileField("Nome de Exibição", value)}
                    placeholder={sessionData.player.id}
                  />
                  <TextField
                    label="Título"
                    value={stringValue(profileFields["Título"])}
                    onChange={(value) => updateProfileField("Título", value)}
                    placeholder="Ex.: Mestre dos artefatos"
                  />
                  <TextField
                    label="Ano em que começou"
                    value={stringValue(profileFields["Ano que começou"])}
                    onChange={(value) => updateProfileField("Ano que começou", value)}
                    placeholder="2020"
                  />
                  <TextAreaField
                    label="Bio"
                    value={stringValue(profileFields["Bio"])}
                    onChange={(value) => updateProfileField("Bio", value)}
                    placeholder="Conte um pouco sobre você e seu estilo de jogo."
                    rows={5}
                  />
                </div>
              </div>

              <div className="editor-form-section">
                <div className="editor-section-heading">
                  <h2>Imagens</h2>
                  <p>As imagens são comprimidas no navegador e enviadas diretamente ao Cloudinary.</p>
                </div>

                <div className="editor-form-grid">
                  <ImageUrlField
                    label="Foto de perfil"
                    value={stringValue(profileFields["Foto URL"])}
                    onChange={(value) => updateProfileField("Foto URL", value)}
                    cloudinary={cloudinary}
                  />
                  <ImageUrlField
                    label="Imagem de capa"
                    value={stringValue(profileFields["Header URL"])}
                    onChange={(value) => updateProfileField("Header URL", value)}
                    cloudinary={cloudinary}
                  />
                </div>
              </div>

              <div className="editor-form-section">
                <div className="editor-section-heading">
                  <h2>Preferências</h2>
                  <p>A busca preenche automaticamente a imagem e o link do Scryfall.</p>
                </div>

                <div className="editor-form-grid">
                  <TextField
                    label="Deck favorito"
                    value={stringValue(profileFields["Deck Favorito"])}
                    onChange={(value) => updateProfileField("Deck Favorito", value)}
                    list="editor-deck-options"
                    placeholder="Escolha um deck cadastrado"
                  />
                  <TextField
                    label="Set favorito"
                    value={stringValue(profileFields["Set Favorito"])}
                    onChange={(value) => updateProfileField("Set Favorito", value)}
                  />
                  <TextField
                    label="Classe Keyrune do set"
                    value={stringValue(profileFields["Ícone Set Favorito"])}
                    onChange={(value) => updateProfileField("Ícone Set Favorito", value)}
                    placeholder="ss ss-mh3 ss-mythic ss-grad"
                  />
                  <TextField
                    label="Link do set"
                    type="url"
                    value={stringValue(profileFields["Link Set Favorito"])}
                    onChange={(value) => updateProfileField("Link Set Favorito", value)}
                  />
                </div>

                <div className="editor-card-lookup-grid">
                  <CardLookupFields
                    label="Comandante favorito"
                    nameField="Comandante Favorito"
                    imageField="Imagem Comandante Favorito"
                    linkField="Scryfall Comandante Favorito"
                    fields={profileFields}
                    onChange={updateProfileField}
                  />
                  <CardLookupFields
                    label="Criatura favorita"
                    nameField="Criatura Favorita"
                    imageField="Imagem Criatura Favorita"
                    linkField="Scryfall Criatura Favorita"
                    fields={profileFields}
                    onChange={updateProfileField}
                  />
                  <CardLookupFields
                    label="Carta favorita"
                    nameField="Carta Favorita"
                    imageField="Imagem Carta Favorita"
                    linkField="Scryfall Carta Favorita"
                    fields={profileFields}
                    onChange={updateProfileField}
                  />
                  <CardLookupFields
                    label="Planeswalker favorito"
                    nameField="Planeswalker Favorito"
                    imageField="Imagem Planeswalker Favorito"
                    linkField="Scryfall Planeswalker Favorito"
                    fields={profileFields}
                    onChange={updateProfileField}
                  />
                </div>
              </div>
            </>
          ) : null}

          {activeSection === "decks" ? (
            <>
              <div className="editor-page-heading">
                <div>
                  <span>Propriedade verificada</span>
                  <h1>Meus decks</h1>
                  <p>Somente decks cujo autor é {sessionData.player.id} aparecem aqui.</p>
                </div>
              </div>

              {sessionData.decks.length ? (
                <>
                  <div className="editor-deck-tabs">
                    {sessionData.decks.map((deck) => (
                      <button
                        type="button"
                        key={deck.id}
                        className={activeDeckId === deck.id ? "active" : ""}
                        onClick={() => setActiveDeckId(deck.id)}
                      >
                        {deck.id}
                      </button>
                    ))}
                  </div>

                  {activeDeck ? (
                    <div className="editor-deck-editor">
                      <div className="editor-page-heading editor-deck-heading">
                        <div>
                          <span>Deck cadastrado</span>
                          <h2>{activeDeck.id}</h2>
                        </div>
                        <button
                          className="editor-primary-button editor-save-button"
                          type="button"
                          onClick={() => void saveDeck(activeDeck.id)}
                          disabled={savingTarget === `deck:${activeDeck.id}`}
                        >
                          {savingTarget === `deck:${activeDeck.id}` ? (
                            <LoaderCircle size={18} className="spin" />
                          ) : (
                            <Save size={18} />
                          )}
                          {savingTarget === `deck:${activeDeck.id}` ? "Salvando..." : "Salvar deck"}
                        </button>
                      </div>

                      <div className="editor-form-section">
                        <div className="editor-section-heading">
                          <h2>Informações do deck</h2>
                        </div>
                        <div className="editor-form-grid">
                          <TextField
                            label="Comandante"
                            value={stringValue(currentDeckFields["Comandante"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Comandante", value)}
                          />
                          <TextField
                            label="Cores"
                            value={stringValue(currentDeckFields["Cores"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Cores", value)}
                            placeholder="Ex.: WUBRG, Izzet, Incolor"
                          />
                          <TextField
                            label="Comandante secundário"
                            value={stringValue(currentDeckFields["Comandante Secundário"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Comandante Secundário", value)}
                          />
                          <TextField
                            label="Tipo do secundário"
                            value={stringValue(currentDeckFields["Tipo Comandante Secundário"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Tipo Comandante Secundário", value)}
                            placeholder="Parceiro, Background, Doctor's companion..."
                          />
                          <TextField
                            label="Bracket"
                            value={stringValue(currentDeckFields["Bracket"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Bracket", value)}
                          />
                          <TextField
                            label="Facilidade de uso (1 a 5)"
                            type="number"
                            value={stringValue(currentDeckFields["Facilidade de Uso"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Facilidade de Uso", value)}
                          />
                          <TextField
                            label="Link da justificativa de bracket"
                            type="url"
                            value={stringValue(currentDeckFields["Bracket URL"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Bracket URL", value)}
                          />
                          <TextField
                            label="Link externo da decklist"
                            type="url"
                            value={stringValue(currentDeckFields["Decklist URL"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Decklist URL", value)}
                          />
                          <TextAreaField
                            label="Bio do deck"
                            value={stringValue(currentDeckFields["Bio"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Bio", value)}
                            rows={5}
                          />
                          <TextAreaField
                            label="Decklist em texto"
                            value={stringValue(currentDeckFields["Decklist Texto"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Decklist Texto", value)}
                            placeholder="1 Sol Ring\n1 Command Tower\n..."
                            rows={10}
                          />
                        </div>
                      </div>

                      <div className="editor-form-section">
                        <div className="editor-section-heading">
                          <h2>Imagens do deck</h2>
                        </div>
                        <div className="editor-form-grid">
                          <ImageUrlField
                            label="Foto do comandante"
                            value={stringValue(currentDeckFields["Foto URL"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Foto URL", value)}
                            cloudinary={cloudinary}
                          />
                          <ImageUrlField
                            label="Arte do deck"
                            value={stringValue(currentDeckFields["Arte URL"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Arte URL", value)}
                            cloudinary={cloudinary}
                          />
                          <ImageUrlField
                            label="Imagem de capa"
                            value={stringValue(currentDeckFields["Header URL"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Header URL", value)}
                            cloudinary={cloudinary}
                          />
                          <ImageUrlField
                            label="Foto do comandante secundário"
                            value={stringValue(currentDeckFields["Foto Comandante Secundário"])}
                            onChange={(value) =>
                              updateDeckField(activeDeck.id, "Foto Comandante Secundário", value)
                            }
                            cloudinary={cloudinary}
                          />
                        </div>
                      </div>

                      <div className="editor-form-section">
                        <div className="editor-section-heading">
                          <h2>Cartas-chave</h2>
                          <p>Use a busca do Scryfall para preencher nome, arte e link.</p>
                        </div>
                        <div className="editor-card-lookup-grid">
                          {[1, 2, 3, 4, 5].map((index) => (
                            <CardLookupFields
                              key={index}
                              label={`Carta-chave ${index}`}
                              nameField={`Carta Chave ${index}`}
                              imageField={`Arte Carta Chave ${index}`}
                              linkField={`Scryfall Carta Chave ${index}`}
                              fields={currentDeckFields}
                              onChange={(field, value) => updateDeckField(activeDeck.id, field, value)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <EditorNotice kind="info">
                  Nenhum deck está cadastrado com você no campo Autor da aba DECKS_INFO.
                </EditorNotice>
              )}
            </>
          ) : null}

          {activeSection === "access" ? (
            <>
              <div className="editor-page-heading">
                <div>
                  <span>Acesso superficial</span>
                  <h1>Alterar PIN</h1>
                  <p>Use entre quatro e oito números e evite senhas utilizadas em outros serviços.</p>
                </div>
              </div>

              <div className="editor-form-section editor-access-card">
                <div className="editor-form-grid">
                  <TextField
                    label="Novo PIN"
                    value={nextPin}
                    onChange={(value) => setNextPin(value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="4 a 8 números"
                  />
                  <TextField
                    label="Confirmar novo PIN"
                    value={confirmNextPin}
                    onChange={(value) => setConfirmNextPin(value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="Repita o PIN"
                  />
                </div>

                <button
                  className="editor-primary-button editor-save-button"
                  type="button"
                  onClick={() => void changePin()}
                  disabled={savingTarget === "pin"}
                >
                  {savingTarget === "pin" ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <KeyRound size={18} />
                  )}
                  {savingTarget === "pin" ? "Alterando..." : "Alterar PIN"}
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <datalist id="editor-deck-options">
        {publicDecks.map((deck) => (
          <option value={deck} key={deck} />
        ))}
      </datalist>
    </main>
  );
}
