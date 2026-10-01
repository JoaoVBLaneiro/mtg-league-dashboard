import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  CheckCircle2,
  Check,
  Eye,
  EyeOff,
  ImageUp,
  Images,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Plus,
  PauseCircle,
  PlayCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRoundCog,
  UserPlus,
  Wand2,
  Trophy,
  Flame,
  Skull,
  Star,
  Sword,
  Crown,
  Shield,
  Zap,
  Target,
  Hammer,
} from "lucide-react";
import { getNewDeckNameError, normalizeDeckName } from "./editorDecks";
import { findCardOnScryfall } from "./editorScryfall";
import CardArtPicker from "./CardArtPicker";
import KeyrunePicker from "./KeyrunePicker";
import RegisterPlayer, { type PlayerRegistrationInput } from "./RegisterPlayer";
import AdminTagsPanel from "./AdminTagsPanel";
import PowerCheckPanel from "./PowerCheckPanel";
import { mythicKeyrune, type KeyruneUsage } from "./keyruneSymbols";
import { DECK_CATEGORIES, readDeckCategories, toggleDeckCategory } from "./deckMetadata";
import { DeckCategoryIcon, DeckLabels, InactiveDeckIcon } from "./DeckLabels";
import "./playerEditor.css";

const API_BASE_URL = "https://api.corneliomove.com.br/mtg-api";
const DASHBOARD_URL = `${API_BASE_URL}/api/dashboard`;

const SESSION_STORAGE_KEY = "mtg-player-editor-session";

type EditorSection =
  | "profile"
  | "decks"
  | "powercheck"
  | "access"
  | "register"
  | "admin";

function readEditorIntent() {
  const searchParams = new URLSearchParams(window.location.search);
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashQueryIndex = rawHash.indexOf("?");
  const hashParams = new URLSearchParams(
    hashQueryIndex >= 0
      ? rawHash.slice(hashQueryIndex + 1)
      : "",
  );

  const section =
    hashParams.get("section")
    || searchParams.get("section")
    || "";
  const deck =
    hashParams.get("deck")
    || searchParams.get("deck")
    || "";

  return {
    section:
      section === "powercheck"
        ? "powercheck"
        : "",
    deck: deck.trim(),
  } as const;
}

type EditorFields = Record<string, string | number | null>;

type EditorDeck = {
  id: string;
  fields: EditorFields;
};

type AchievementTier = "common" | "uncommon" | "rare" | "mythic" | "legendary";

type EditorAchievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: AchievementTier;
};

type EditorSessionData = {
  deckManagementVersion?: number;
  playerManagementVersion?: number;
  featuredAchievementsVersion?: number;
  achievements?: EditorAchievement[];
  keyruneUsage?: KeyruneUsage[];
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
  status?: "valid" | "pending" | "complete" | "error";
  deckId?: string;
  playerId?: string;
  warnings?: string[];
  duplicate?: boolean;
  message?: string;
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

type AdminMatchPlayer = {
  player: string;
  deck: string | null;
  winner: boolean;
  seat: number | null;
};

type AdminMatch = {
  dbId: number;
  matchId: number;
  playedAt: string;
  winner: string | null;
  source: string;
  ignored: boolean;
  reason: string;
  players: AdminMatchPlayer[];
};

type AdminMatchesResponse = {
  ok?: boolean;
  error?: string;
  matches?: AdminMatch[];
};

type CloudinaryConfig = EditorSessionData["cloudinary"];

function stringValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function parseFeaturedAchievementIds(value: string | number | null | undefined) {
  const text = stringValue(value).trim();

  if (!text) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set<string>();

    return parsed
      .map((item) => String(item || "").trim())
      .filter((id) => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, 3);
  } catch {
    return [];
  }
}

function getEditorAchievementTierLabel(tier: AchievementTier) {
  const labels: Record<AchievementTier, string> = {
    common: "Comum",
    uncommon: "Incomum",
    rare: "Rara",
    mythic: "Mítica",
    legendary: "Lendária",
  };

  return labels[tier] || "Comum";
}

function getEditorAchievementIcon(icon: string) {
  const normalizedIcon = String(icon || "").trim().toLowerCase();

  const iconMap: Record<string, React.ReactNode> = {
    trophy: <Trophy size={20} />,
    flame: <Flame size={20} />,
    skull: <Skull size={20} />,
    star: <Star size={20} />,
    sparkles: <Sparkles size={20} />,
    sword: <Sword size={20} />,
    swords: <Sword size={20} />,
    eye: <Eye size={20} />,
    crown: <Crown size={20} />,
    shield: <Shield size={20} />,
    zap: <Zap size={20} />,
    target: <Target size={20} />,
    book: <BookOpen size={20} />,
    hammer: <Hammer size={20} />,
  };

  return iconMap[normalizedIcon] || <Star size={20} />;
}

function FeaturedAchievementsPicker({
  achievements,
  value,
  disabled,
  onChange,
}: {
  achievements: EditorAchievement[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const availableIds = new Set(achievements.map((achievement) => achievement.id));
  const savedIds = parseFeaturedAchievementIds(value);
  const selectedIds = savedIds.filter((id) => availableIds.has(id));
  const unavailableCount = savedIds.length - selectedIds.length;
  //const selectedSet = new Set(selectedIds);

  function toggleAchievement(id: string) {
    if (disabled) return;

    const cleanCurrent = savedIds.filter((savedId) => availableIds.has(savedId));

    if (cleanCurrent.includes(id)) {
      onChange(JSON.stringify(cleanCurrent.filter((savedId) => savedId !== id)));
      return;
    }

    if (cleanCurrent.length >= 3) {
      return;
    }

    onChange(JSON.stringify([...cleanCurrent, id]));
  }

  if (!achievements.length) {
    return (
      <div className="editor-featured-achievements-empty">
        <Sparkles size={20} />
        <div>
          <strong>Nenhuma conquista desbloqueada ainda</strong>
          <span>Quando você desbloquear conquistas, elas aparecerão aqui para escolher.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-featured-achievements">
      <div className="editor-featured-achievements-summary">
        <span>
          {selectedIds.length}/3 selecionadas
        </span>

        {savedIds.length ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("[]")}
          >
            Usar seleção automática
          </button>
        ) : (
          <small>Usando seleção automática</small>
        )}
      </div>

      {unavailableCount > 0 ? (
        <div className="editor-featured-achievements-warning">
          <AlertTriangle size={16} />
          <span>
            {unavailableCount === 1
              ? "1 destaque salvo está bloqueado no momento. Ele será removido se você alterar esta seleção."
              : `${unavailableCount} destaques salvos estão bloqueados no momento. Eles serão removidos se você alterar esta seleção.`}
          </span>
        </div>
      ) : null}

      <div className="editor-featured-achievements-grid">
        {achievements.map((achievement) => {
          const selectedIndex = selectedIds.indexOf(achievement.id);
          const selected = selectedIndex >= 0;
          const limitReached = selectedIds.length >= 3 && !selected;

          return (
            <button
              key={achievement.id}
              className={`editor-featured-achievement-card editor-featured-achievement-card-${achievement.tier} ${
                selected ? "selected" : ""
              }`}
              type="button"
              disabled={Boolean(disabled || limitReached)}
              aria-pressed={selected}
              onClick={() => toggleAchievement(achievement.id)}
            >
              <span className="editor-featured-achievement-icon">
                {getEditorAchievementIcon(achievement.icon)}
              </span>

              <span className="editor-featured-achievement-copy">
                <strong>{achievement.name}</strong>
                <small>{getEditorAchievementTierLabel(achievement.tier)}</small>
                <span>{achievement.description}</span>
              </span>

              {selected ? (
                <span
                  className="editor-featured-achievement-order"
                  title={`Destaque ${selectedIndex + 1}`}
                >
                  {selectedIndex + 1}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/^Error:\s*/i, "");
  }

  return "Ocorreu um erro inesperado.";
}

async function readJsonResponse(response: Response) {
  const json = (await response.json()) as EditorApiResponse;

  if (!response.ok || json.ok === false || json.error) {
    throw new Error(json.error || "Não foi possível concluir a solicitação.");
  }

  return json;
}

function editorAuthHeaders(currentToken: string) {
  return {
    Authorization: `Bearer ${currentToken}`,
  };
}

async function requestEditorLogin(player: string, pin: string) {
  const response = await fetch(`${API_BASE_URL}/api/editor/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ player, pin }),
  });

  return readJsonResponse(response);
}

async function requestEditorSession(currentToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/editor/session`, {
    headers: editorAuthHeaders(currentToken),
  });
  const json = await readJsonResponse(response);

  if (!json.data) {
    throw new Error("O backend não retornou os dados do editor.");
  }

  return json.data;
}

async function requestEditorLogout(currentToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/editor/logout`, {
    method: "POST",
    headers: editorAuthHeaders(currentToken),
  });

  return readJsonResponse(response);
}

async function requestAdminMatches(currentToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/admin/matches`, {
    headers: editorAuthHeaders(currentToken),
  });

  const json = (await response.json()) as AdminMatchesResponse;

  if (!response.ok || json.ok === false || json.error) {
    throw new Error(json.error || "Não foi possível carregar as partidas.");
  }

  return json.matches || [];
}

async function requestAdminMatchOverride(
  currentToken: string,
  dbId: number,
  action: "ignore" | "restore",
  reason = ""
) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/matches/${dbId}/${action}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...editorAuthHeaders(currentToken),
      },
      body: JSON.stringify({ reason }),
    }
  );

  return readJsonResponse(response);
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
  required = false,
  allowArtSelection = false,
}: {
  label: string;
  nameField: string;
  imageField: string;
  linkField?: string;
  fields: EditorFields;
  onChange: (field: string, value: string) => void;
  required?: boolean;
  allowArtSelection?: boolean;
}) {
  const inputId = useId();
  const lookupVersion = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [choosingArt, setChoosingArt] = useState(false);
  const name = stringValue(fields[nameField]);
  const imageUrl = stringValue(fields[imageField]);

  useEffect(() => () => { lookupVersion.current++; }, []);

  async function resolveCard() {
    if (loading) return;
    const version = ++lookupVersion.current;
    try {
      setLoading(true);
      setError("");
      const card = await findCardOnScryfall(name);
      // Não aplica uma busca antiga depois de trocar de deck ou fechar o editor.
      if (version !== lookupVersion.current) return;
      onChange(nameField, card.name);
      if (card.imageUrl) onChange(imageField, card.imageUrl);
      if (linkField) onChange(linkField, card.scryfallUrl);
    } catch (lookupError) {
      if (version === lookupVersion.current) setError(normalizeErrorMessage(lookupError));
    } finally {
      if (version === lookupVersion.current) setLoading(false);
    }
  }

  return (
    <div className="editor-card-lookup" aria-busy={loading}>
      <div className="editor-card-lookup-image">
        {imageUrl ? <img src={imageUrl} alt={name || label} /> : <Wand2 size={25} />}
      </div>

      <div className="editor-card-lookup-fields">
        <label htmlFor={inputId}>{label}</label>
        <div className="editor-card-name-row">
          <input
            id={inputId}
            value={name}
            onChange={(event) => {
              setError(""); onChange(nameField, event.target.value);
              if (allowArtSelection) {
                onChange(imageField, "");
                if (linkField) onChange(linkField, "");
              }
            }}
            placeholder="Nome da carta"
            disabled={loading}
            aria-required={required}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void resolveCard();
              }
            }}
          />
          <button type="button" onClick={() => void resolveCard()} disabled={loading}
            aria-label={`Buscar ${label.replace(/\s*\*$/, "")} no Scryfall`}>
            {loading ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
            Buscar
          </button>
        </div>
        {allowArtSelection ? <button type="button" className="editor-art-trigger" disabled={loading || !name.trim()}
          aria-haspopup="dialog" aria-label={`Escolher arte de ${label.replace(/\s*\*$/, "")}`}
          onClick={() => setChoosingArt(true)}><Images size={16} /> Escolher arte</button> : null}
        {error ? <small id={`${inputId}-error`} className="editor-field-error" role="alert">{error}</small> : null}
      </div>
      {choosingArt ? <CardArtPicker cardName={name} currentImage={imageUrl} onClose={() => setChoosingArt(false)}
        onSelect={(card) => {
          lookupVersion.current++;
          onChange(nameField, card.name);
          onChange(imageField, card.imageUrl);
          if (linkField) onChange(linkField, card.scryfallUrl);
          setChoosingArt(false);
        }} /> : null}
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
  const editorIntent = useMemo(
    () => readEditorIntent(),
    [],
  );
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
  const [activeSection, setActiveSection] = useState<EditorSection>(
    () =>
      editorIntent.section === "powercheck"
        ? "powercheck"
        : "profile"
  );
  const [activeDeckId, setActiveDeckId] = useState("");
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckFields, setNewDeckFields] = useState<EditorFields>({});
  const newDeckRequestId = useRef("");
  const createInFlight = useRef(false);
  const deckActionInFlight = useRef(false);
  const deckMutationRequestIds = useRef<Record<string, string>>({});
  const deckDeleteRequestIds = useRef<Record<string, string>>({});
  const [deleteDeckTarget, setDeleteDeckTarget] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [savingTarget, setSavingTarget] = useState("");
  const [notice, setNotice] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [nextPin, setNextPin] = useState("");
  const [confirmNextPin, setConfirmNextPin] = useState("");
  const [adminMatches, setAdminMatches] = useState<AdminMatch[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminTab, setAdminTab] = useState<"matches" | "tags">("matches");

  const activeDeck = useMemo(
    () => isCreatingDeck
      ? { id: "", fields: {} }
      : sessionData?.decks.find((deck) => deck.id === activeDeckId) || null,
    [isCreatingDeck, sessionData?.decks, activeDeckId]
  );

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (deleteDeckTarget && dialog && !dialog.open) dialog.showModal();
    if (!deleteDeckTarget && dialog?.open) dialog.close();
  }, [deleteDeckTarget]);

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

  useEffect(() => {
    async function loadDirectory() {
      try {
        setDirectoryLoading(true);
        const response = await fetch(`${DASHBOARD_URL}?t=${Date.now()}`);

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
      const json = await requestEditorLogin(
        selectedPlayer,
        pin
      );

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
    action: "editorUpdateProfile" | "editorUpdateDeck" | "editorUpdatePin" | "editorCreateDeck" | "editorDeleteDeck" | "editorCreatePlayer",
    payload: Record<string, unknown>
  ) {
    if (!token) {
      throw new Error("Sua sessão expirou. Entre novamente.");
    }

    const route =
      action === "editorUpdateProfile"
        ? "/api/editor/profile"
        : action === "editorUpdatePin"
          ? "/api/editor/pin"
          : action === "editorCreatePlayer"
            ? "/api/editor/players"
            : "/api/editor/decks";

    const body =
      action === "editorUpdateDeck" ||
      action === "editorCreateDeck" ||
      action === "editorDeleteDeck"
        ? { action, ...payload }
        : payload;

    const response = await fetch(`${API_BASE_URL}${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...editorAuthHeaders(token),
      },
      body: JSON.stringify(body),
    });

    return readJsonResponse(response);
  }

  function updateProfileField(field: string, value: string) {
    setProfileFields((current) => ({ ...current, [field]: value }));
  }

  function updateDeckField(deckId: string, field: string, value: string) {
    if (isCreatingDeck && !deckId) {
      setNewDeckFields((current) => ({ ...current, [field]: value }));
      return;
    }

    delete deckMutationRequestIds.current[`${deckId}:fields`];

    setDeckFields((current) => ({
      ...current,
      [deckId]: {
        ...(current[deckId] || {}),
        [field]: value,
      },
    }));
  }

  function openNewDeck() {
    if (savingTarget) return;
    if (!newDeckRequestId.current) newDeckRequestId.current = crypto.randomUUID();
    setIsCreatingDeck(true);
    setNotice(null);
  }

  function cancelNewDeck() {
    if (savingTarget) return;
    if ((newDeckName || Object.values(newDeckFields).some(Boolean)) &&
        !window.confirm("Descartar as informações deste novo deck?")) return;
    setIsCreatingDeck(false);
    setNewDeckName("");
    setNewDeckFields({});
    newDeckRequestId.current = "";
    setNotice(null);
  }

  async function createDeck() {
    if (!sessionData || createInFlight.current || savingTarget) return;
    const nameError = getNewDeckNameError(newDeckName, publicDecks.concat(sessionData.decks.map((deck) => deck.id)));
    if (nameError || !stringValue(newDeckFields["Comandante"]).trim()) {
      setNotice({ kind: "error", text: nameError || "Informe o comandante do deck." });
      return;
    }

    createInFlight.current = true;
    setSavingTarget("create");
    setNotice(null);
    if (!newDeckRequestId.current) newDeckRequestId.current = crypto.randomUUID();
    const requestId = newDeckRequestId.current;
    try {
      const result = await sendEditorAction("editorCreateDeck", {
        requestId, deckName: normalizeDeckName(newDeckName), fields: newDeckFields,
      });
      if (!result.deckId) {
        throw new Error("O backend não retornou o deck criado.");
      }
      const createdId = result.deckId;
      const warnings = [...(result.warnings || [])];

      setIsCreatingDeck(false);
      setNewDeckName("");
      setNewDeckFields({});
      newDeckRequestId.current = "";
      setPublicDecks((current) => Array.from(new Set([...current, createdId])).sort());
      try {
        const data = await requestEditorSession(token);
        const createdDeck = data.decks.find((deck) => deck.id === createdId);
        if (!createdDeck) throw new Error("O deck não foi retornado pela sessão.");
        setSessionData(data);
        // Preserva outros rascunhos de perfil/decks que ainda não foram salvos.
        setDeckFields((current) => ({ ...current, [createdId]: { ...createdDeck.fields } }));
        setActiveDeckId(createdId);
      } catch {
        warnings.push("Recarregue a página para abrir o deck recém-criado.");
      }
      setNotice({
        kind: warnings.length ? "info" : "success",
        text: `Deck ${createdId} criado com sucesso. ${warnings.join(" ")}`.trim(),
      });
    } catch (error) {
      setNotice({ kind: "error", text: normalizeErrorMessage(error) });
    } finally {
      createInFlight.current = false;
      setSavingTarget("");
    }
  }

  async function saveProfile() {
    try {
      setSavingTarget("profile");
      setNotice(null);
      await sendEditorAction("editorUpdateProfile", { fields: profileFields });
      const updated = await requestEditorSession(token);
      for (const field of ['Ícone Keyrune', 'Ícone Set Favorito']) {
        if (sessionData?.playerManagementVersion && stringValue(updated.player.fields[field]) !== mythicKeyrune(stringValue(profileFields[field]))) {
          throw new Error('O símbolo ainda não foi confirmado pelo backend. Recarregue e tente novamente.');
        }
      }
      applySessionData(updated);
      setNotice({ kind: "success", text: "Perfil salvo e dashboard atualizado." });
    } catch (error) {
      setNotice({ kind: "error", text: normalizeErrorMessage(error) });
    } finally {
      setSavingTarget("");
    }
  }

  async function saveDeck(deckId: string, statusOnly?: "Ativo" | "Inativo") {
    if (savingTarget || deckActionInFlight.current) return;
    if (!sessionData?.deckManagementVersion) {
      setNotice({ kind: "error", text: "O backend ainda não habilitou a edição de status e categorias." });
      return;
    }
    deckActionInFlight.current = true;
    try {
      setSavingTarget(`deck:${deckId}`);
      setNotice(null);

      const requestKey = statusOnly
        ? `${deckId}:status:${statusOnly}`
        : `${deckId}:fields`;

      const requestId =
        deckMutationRequestIds.current[requestKey]
        || crypto.randomUUID();

      deckMutationRequestIds.current[requestKey] = requestId;

      const result = await sendEditorAction("editorUpdateDeck", {
        deckId,
        requestId,
        fields: statusOnly ? { Status: statusOnly } : deckFields[deckId] || {},
      });

      delete deckMutationRequestIds.current[requestKey];

      const warnings = [...(result.warnings || [])];
      if (statusOnly) {
        setDeckFields((current) => ({ ...current, [deckId]: { ...current[deckId], Status: statusOnly } }));
        setSessionData((current) => current ? { ...current, decks: current.decks.map((deck) => deck.id === deckId
          ? { ...deck, fields: { ...deck.fields, Status: statusOnly } } : deck) } : current);
      }
      try {
        const data = await requestEditorSession(token);
        const updated = data.decks.find((deck) => deck.id === deckId);
        if (!updated) throw new Error("Deck não retornado.");
        setSessionData(data);
        setDeckFields((current) => ({ ...current, [deckId]: statusOnly
          ? { ...current[deckId], Status: updated.fields.Status }
          : { ...updated.fields } }));
      } catch { warnings.push("Recarregue para visualizar os dados confirmados."); }
      setNotice({ kind: warnings.length ? "info" : "success", text:
        `${statusOnly ? `Deck marcado como ${statusOnly.toLowerCase()}.` : `Deck ${deckId} salvo com sucesso.`} ${warnings.join(" ")}`.trim() });
    } catch (error) {
      setNotice({ kind: "error", text: normalizeErrorMessage(error) });
    } finally {
      deckActionInFlight.current = false;
      setSavingTarget("");
    }
  }

  async function registerPlayer(input: PlayerRegistrationInput) {
    if (!sessionData?.playerManagementVersion) throw new Error("Cadastro de jogador indisponível no backend.");
    setSavingTarget("new-player");
    try {
      const result = await sendEditorAction("editorCreatePlayer", input);
      if (!result.playerId) {
        throw new Error("O backend não retornou o jogador criado.");
      }
      setPublicPlayers((current) =>
        current.some((player) => player.id === result.playerId)
          ? current
          : [...current, { id: result.playerId!, label: result.playerId! }]
      );
      try {
        setSessionData(await requestEditorSession(token));
      } catch {
        result.warnings = [
          ...(result.warnings || []),
          "Reabra a área para atualizar os símbolos em uso.",
        ];
      }
      return {
        playerId: result.playerId,
        warnings: result.warnings,
      };
    } finally {
      setSavingTarget("");
    }
  }

  async function deleteDeck() {
    if (savingTarget || deckActionInFlight.current || !deleteDeckTarget || deleteConfirmation.trim() !== deleteDeckTarget) return;
    if (!sessionData?.deckManagementVersion) {
      setNotice({ kind: "error", text: "O backend ainda não habilitou a exclusão de decks." });
      return;
    }
    deckActionInFlight.current = true;
    const deckId = deleteDeckTarget;
    try {
      setSavingTarget(`delete:${deckId}`);
      setNotice(null);

      const requestId =
        deckDeleteRequestIds.current[deckId]
        || crypto.randomUUID();

      deckDeleteRequestIds.current[deckId] = requestId;

      const result = await sendEditorAction("editorDeleteDeck", {
        deckId,
        requestId,
        confirmDeckName: deleteConfirmation.trim(),
      });

      delete deckDeleteRequestIds.current[deckId];
      const remaining = sessionData.decks.filter((deck) => deck.id !== deckId);
      setSessionData({ ...sessionData, decks: remaining });
      setDeckFields((current) => {
        const next = { ...current }; delete next[deckId]; return next;
      });
      setPublicDecks((current) => current.filter((name) => name !== deckId));
      setActiveDeckId(remaining[0]?.id || "");
      setDeleteDeckTarget("");
      setDeleteConfirmation("");
      const warnings = result.warnings || [];
      setNotice({ kind: warnings.length ? "info" : "success", text:
        `Deck ${deckId} excluído do cadastro. Histórico preservado; a administração pode recuperá-lo pela planilha. ${warnings.join(" ")}`.trim() });
    } catch (error) {
      setNotice({ kind: "error", text: normalizeErrorMessage(error) });
    } finally {
      deckActionInFlight.current = false;
      setSavingTarget("");
    }
  }

  async function loadAdminMatches() {
    if (!token || sessionData?.player.id !== "JBL") return;

    try {
      setAdminLoading(true);
      setAdminMatches(await requestAdminMatches(token));
    } catch (error) {
      setNotice({ kind: "error", text: normalizeErrorMessage(error) });
    } finally {
      setAdminLoading(false);
    }
  }

  async function toggleIgnoredMatch(match: AdminMatch) {
    if (!token || sessionData?.player.id !== "JBL" || savingTarget) return;

    const restoring = match.ignored;
    const reason = restoring
      ? ""
      : window.prompt(
          `Motivo para ignorar a partida #${match.matchId}:`,
          "Partida cadastrada incorretamente"
        );

    if (!restoring && reason === null) return;

    if (!window.confirm(
      restoring
        ? `Restaurar a partida #${match.matchId}?`
        : `Ignorar a partida #${match.matchId}? Ela deixará de contar nas estatísticas.`
    )) return;

    try {
      setSavingTarget(`admin:${match.dbId}`);
      setNotice(null);
      await requestAdminMatchOverride(
        token,
        match.dbId,
        restoring ? "restore" : "ignore",
        reason || ""
      );
      await loadAdminMatches();
      setNotice({
        kind: "success",
        text: restoring
          ? `Partida #${match.matchId} restaurada.`
          : `Partida #${match.matchId} ignorada.`,
      });
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

      let json: EditorApiResponse;

      try {
        await sendEditorAction("editorUpdatePin", { nextPin });

        json = await requestEditorLogin(
          sessionData.player.id,
          nextPin
        );
      } catch (error) {
        try {
          json = await requestEditorLogin(
            sessionData.player.id,
            nextPin
          );
        } catch {
          throw error;
        }
      }

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
    if (savingTarget) return;
    if (token) {
      void requestEditorLogout(token).catch(() => undefined);
    }

    localStorage.removeItem(SESSION_STORAGE_KEY);
    setToken("");
    setSessionData(null);
    setProfileFields({});
    setDeckFields({});
    setIsCreatingDeck(false);
    setNewDeckName("");
    setNewDeckFields({});
    newDeckRequestId.current = "";
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
  const currentDeckFields = isCreatingDeck ? newDeckFields : activeDeck ? deckFields[activeDeck.id] || {} : {};

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
          <button type="button" onClick={logout} disabled={Boolean(savingTarget)}>
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
            disabled={Boolean(savingTarget)}
          >
            <UserRoundCog size={19} />
            Meu perfil
          </button>

          <button
            className={activeSection === "decks" ? "active" : ""}
            type="button"
            onClick={() => setActiveSection("decks")}
            disabled={Boolean(savingTarget)}
          >
            <BookOpen size={19} />
            Meus decks
            <span>{sessionData.decks.length}</span>
          </button>

          <button
            className={activeSection === "powercheck" ? "active" : ""}
            type="button"
            onClick={() => setActiveSection("powercheck")}
            disabled={Boolean(savingTarget)}
          >
            <Zap size={19} />
            Power Check
          </button>

          <button
            className={activeSection === "access" ? "active" : ""}
            type="button"
            onClick={() => setActiveSection("access")}
            disabled={Boolean(savingTarget)}
          >
            <KeyRound size={19} />
            Acesso
          </button>

          {sessionData.player.id === "JBL" ? (
            <button
              type="button"
              className={activeSection === "admin" ? "active" : ""}
              disabled={Boolean(savingTarget)}
              onClick={() => {
                setActiveSection("admin");
                void loadAdminMatches();
              }}
            >
              <ShieldCheck size={19} />
              Administração
            </button>
          ) : null}

          <button type="button" className={activeSection === 'register' ? 'active' : ''}
            disabled={Boolean(savingTarget)} onClick={() => setActiveSection('register')}>
            <UserPlus size={19} /> Cadastrar jogador
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
                  disabled={Boolean(savingTarget)}
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
                  <KeyrunePicker label="Seu símbolo Keyrune" value={stringValue(profileFields['Ícone Keyrune'])}
                    usage={sessionData.keyruneUsage} playerId={sessionData.player.id} disabled={!sessionData.playerManagementVersion || Boolean(savingTarget)}
                    onChange={value => updateProfileField('Ícone Keyrune', value)} />
                  {!sessionData.playerManagementVersion ? <p className="editor-field-hint">Atualize o backend para escolher seu símbolo.</p> : null}
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
                  <h2>Conquistas em destaque</h2>
                  <p>
                    Escolha até três conquistas desbloqueadas para aparecerem ao lado do seu nome.
                    A ordem da seleção define a ordem dos ícones.
                  </p>
                </div>

                {!sessionData.featuredAchievementsVersion ? (
                  <p className="editor-field-hint">
                    Atualize o backend para habilitar a seleção de conquistas em destaque.
                  </p>
                ) : (
                  <FeaturedAchievementsPicker
                    achievements={sessionData.achievements || []}
                    value={stringValue(profileFields["Conquistas em Destaque"])}
                    disabled={Boolean(savingTarget)}
                    onChange={(value) =>
                      updateProfileField("Conquistas em Destaque", value)
                    }
                  />
                )}
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
                  <KeyrunePicker label="Símbolo do set favorito" value={stringValue(profileFields['Ícone Set Favorito'])}
                    usage={sessionData.keyruneUsage} playerId={sessionData.player.id} disabled={!sessionData.playerManagementVersion || Boolean(savingTarget)}
                    onChange={(value, symbol) => { updateProfileField('Ícone Set Favorito', value); if (symbol) updateProfileField('Set Favorito', symbol.name); }} />
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
                <button className="editor-primary-button" type="button"
                  onClick={openNewDeck} disabled={isCreatingDeck || Boolean(savingTarget)}>
                  <Plus size={18} /> Novo deck
                </button>
              </div>

              {sessionData.decks.length || isCreatingDeck ? (
                <>
                  <div className="editor-deck-tabs">
                    {sessionData.decks.map((deck) => (
                      <button
                        type="button"
                        key={deck.id}
                        className={!isCreatingDeck && activeDeckId === deck.id ? "active" : ""}
                        disabled={Boolean(savingTarget)}
                        onClick={() => { setIsCreatingDeck(false); setActiveDeckId(deck.id); }}
                      >
                        {deck.id}
                        {deck.fields.Status === "Inativo" ? <span role="img" aria-label="Inativo" title="Inativo · Ice Age"><InactiveDeckIcon size={14} /></span> : null}
                      </button>
                    ))}
                  </div>

                  {activeDeck ? (
                    <fieldset className="editor-deck-editor" disabled={Boolean(savingTarget)}>
                      <div className="editor-page-heading editor-deck-heading">
                        <div>
                          <span>{isCreatingDeck ? "Novo cadastro" : "Deck cadastrado"}</span>
                          <h2>{isCreatingDeck ? "Monte o perfil do seu deck" : activeDeck.id}</h2>
                          <DeckLabels categories={currentDeckFields.Categorias} inactive={currentDeckFields.Status === "Inativo"} />
                          {isCreatingDeck ? <p>Nome e comandante são obrigatórios. Você pode completar o restante depois.</p> : null}
                        </div>
                        <div className="editor-heading-actions">
                        {isCreatingDeck ? (
                          <button type="button" className="editor-secondary-button" onClick={cancelNewDeck}>
                            Cancelar
                          </button>
                        ) : null}
                        <button
                          className="editor-primary-button editor-save-button"
                          type="button"
                          onClick={() => void (isCreatingDeck ? createDeck() : saveDeck(activeDeck.id))}
                          disabled={Boolean(savingTarget)}
                        >
                          {savingTarget ? (
                            <LoaderCircle size={18} className="spin" />
                          ) : (
                            <Save size={18} />
                          )}
                          {savingTarget ? (isCreatingDeck ? "Criando..." : "Salvando...") : isCreatingDeck ? "Criar deck" : "Salvar deck"}
                        </button>
                        </div>
                      </div>

                      {isCreatingDeck ? (
                        <div className="editor-form-section editor-new-deck-identity">
                          <div className="editor-form-grid">
                            <label className="editor-field">
                              <span>Nome do deck *</span>
                              <input value={newDeckName} onChange={(event) => setNewDeckName(event.target.value)}
                                maxLength={80} placeholder={`Ex.: Meren - ${sessionData.player.id}`} autoFocus />
                            </label>
                            <TextField label="Autor (automático)" value={sessionData.player.id} readOnly />
                          </div>
                          <p className="editor-field-hint">Use um nome único, sem vírgulas. Ele será o identificador do histórico e não poderá ser renomeado aqui.</p>
                        </div>
                      ) : null}

                      <div className="editor-form-section">
                        <div className="editor-section-heading">
                          <h2>Status e categorias</h2>
                          <p>Inativo recebe Ice Age e deixa de ser obrigatório em “Fulano Slayer” e Combobreaker. Se já foi derrotado, aparece como histórico da conquista. Reativar volta a exigi-lo, aproveitando as vitórias antigas. Listas, partidas e rankings são preservados.</p>
                        </div>
                        <label className="editor-field editor-origin-field"><span>Origem do deck</span>
                          <select value={stringValue(currentDeckFields.Origem) || 'Fora'}
                            disabled={(sessionData.deckManagementVersion || 0) < 2}
                            onChange={event => updateDeckField(activeDeck.id, 'Origem', event.target.value)}>
                            <option value="Fixo">Fixo da salinha</option><option value="Fora">De fora</option>
                          </select>
                        </label>
                        {(sessionData.deckManagementVersion || 0) < 2 ? <p className="editor-field-hint">Atualize o backend para editar a origem.</p> : null}
                        <div className="editor-deck-management">
                          <button type="button" className="editor-secondary-button"
                            aria-pressed={currentDeckFields.Status === "Inativo"}
                            onClick={() => {
                              const nextStatus = currentDeckFields.Status === "Inativo" ? "Ativo" : "Inativo";
                              if (isCreatingDeck) updateDeckField("", "Status", nextStatus);
                              else void saveDeck(activeDeck.id, nextStatus);
                            }}>
                            {currentDeckFields.Status === "Inativo" ? <PlayCircle size={17} /> : <PauseCircle size={17} />}
                            {currentDeckFields.Status === "Inativo" ? "Marcar como ativo" : "Marcar como inativo"}
                          </button>
                          {!isCreatingDeck ? <button type="button" className="editor-danger-button" onClick={() => {
                            setDeleteConfirmation(""); setDeleteDeckTarget(activeDeck.id); setNotice(null);
                          }}><Trash2 size={17} /> Excluir deck</button> : null}
                        </div>
                        <div className="editor-category-choices" role="group" aria-label="Categorias do deck">
                          {DECK_CATEGORIES.map((category) => {
                            const selected = readDeckCategories(currentDeckFields.Categorias).includes(category.id);
                            return <button type="button" key={category.id} aria-pressed={selected}
                              className={`editor-category-choice mtg-deck-category-${category.id}${selected ? " selected" : ""}`}
                              onClick={() => updateDeckField(activeDeck.id, "Categorias", toggleDeckCategory(currentDeckFields.Categorias, category.id))}>
                              <DeckCategoryIcon category={category.id} size={20} /> <span>{category.label}</span>
                              {selected ? <Check size={15} aria-hidden="true" /> : null}
                            </button>;
                          })}
                        </div>
                        <p className="editor-field-hint">Pode marcar mais de uma. As categorias são usadas pelas conquistas; clique em {isCreatingDeck ? "Criar deck" : "Salvar deck"} para aplicar.</p>
                      </div>

                      <div className="editor-form-section">
                        <div className="editor-section-heading">
                          <h2>Informações do deck</h2>
                          <p>Digite o comandante e use Buscar ou Escolher arte para selecionar uma edição. O secundário é opcional.</p>
                        </div>
                        <div className="editor-card-lookup-grid editor-commander-lookup-grid">
                          <CardLookupFields
                            key={`commander:${activeDeck.id}`}
                            label={isCreatingDeck ? "Comandante *" : "Comandante"}
                            nameField="Comandante"
                            imageField="Foto URL"
                            fields={currentDeckFields}
                            onChange={(field, value) => updateDeckField(activeDeck.id, field, value)}
                            required={isCreatingDeck}
                            allowArtSelection
                          />
                          <CardLookupFields
                            key={`secondary:${activeDeck.id}`}
                            label="Comandante secundário"
                            nameField="Comandante Secundário"
                            imageField="Foto Comandante Secundário"
                            allowArtSelection
                            fields={currentDeckFields}
                            onChange={(field, value) => updateDeckField(activeDeck.id, field, value)}
                          />
                        </div>
                        <div className="editor-form-grid">
                          <TextField
                            label="Cores"
                            value={stringValue(currentDeckFields["Cores"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Cores", value)}
                            placeholder="Ex.: WUBRG, Izzet, Incolor"
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
                          <p>A foto do comandante aparece nas listas e nos modais, e acompanha a edição escolhida acima. Arte do deck é usada nos banners e no marcador de vida; não substitui essa foto.</p>
                        </div>
                        <div className="editor-form-grid">
                          <ImageUrlField
                            label="Foto do comandante"
                            value={stringValue(currentDeckFields["Foto URL"])}
                            onChange={(value) => updateDeckField(activeDeck.id, "Foto URL", value)}
                            cloudinary={cloudinary}
                          />
                          <ImageUrlField
                            label="Arte do deck (banners e marcador de vida)"
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
                          <p>Busque a carta e use Escolher arte para selecionar a edição que aparecerá no deck.</p>
                        </div>
                        <div className="editor-card-lookup-grid">
                          {[1, 2, 3, 4, 5].map((index) => (
                            <CardLookupFields
                              key={`${activeDeck.id}:key-card:${index}`}
                              label={`Carta-chave ${index}`}
                              nameField={`Carta Chave ${index}`}
                              imageField={`Arte Carta Chave ${index}`}
                              linkField={`Scryfall Carta Chave ${index}`}
                              allowArtSelection
                              fields={currentDeckFields}
                              onChange={(field, value) => updateDeckField(activeDeck.id, field, value)}
                            />
                          ))}
                        </div>
                      </div>
                      {isCreatingDeck ? (
                        <div className="editor-create-footer">
                          <button className="editor-primary-button" type="button" onClick={() => void createDeck()}>
                            {savingTarget ? <LoaderCircle size={18} className="spin" /> : <Plus size={18} />}
                            {savingTarget ? "Criando..." : "Criar deck"}
                          </button>
                        </div>
                      ) : null}
                    </fieldset>
                  ) : null}
                </>
              ) : (
                <EditorNotice kind="info">
                  Você ainda não possui decks cadastrados. Clique em Novo deck para adicionar o primeiro.
                </EditorNotice>
              )}
            </>
          ) : null}

          {activeSection === "powercheck" ? (
            <PowerCheckPanel
              token={token}
              targetDeck={editorIntent.deck}
            />
          ) : null}

          <div hidden={activeSection !== 'register'}>
            <RegisterPlayer enabled={Boolean(sessionData.playerManagementVersion)} usage={sessionData.keyruneUsage || []} onRegister={registerPlayer} />
          </div>

          {activeSection === "admin" && sessionData.player.id === "JBL" ? (
            <>
              <div className="editor-admin-subtabs" role="tablist" aria-label="Administração">
                <button
                  type="button"
                  className={adminTab === "matches" ? "active" : ""}
                  onClick={() => {
                    setAdminTab("matches");
                    void loadAdminMatches();
                  }}
                >
                  Partidas
                </button>

                <button
                  type="button"
                  className={adminTab === "tags" ? "active" : ""}
                  onClick={() => setAdminTab("tags")}
                >
                  Tags
                </button>
              </div>

              {adminTab === "matches" ? (
                <>
              <div className="editor-page-heading">
                <div>
                  <span>Administração JBL</span>
                  <h1>Histórico de partidas</h1>
                  <p>Partidas ignoradas continuam salvas no banco, mas deixam de contar nas estatísticas.</p>
                </div>

                <button
                  className="editor-secondary-button"
                  type="button"
                  disabled={adminLoading || Boolean(savingTarget)}
                  onClick={() => void loadAdminMatches()}
                >
                  {adminLoading ? <LoaderCircle size={17} className="spin" /> : null}
                  Atualizar
                </button>
              </div>

              <div className="editor-admin-match-list">
                {adminLoading && !adminMatches.length ? (
                  <EditorNotice kind="info">Carregando partidas...</EditorNotice>
                ) : null}

                {!adminLoading && !adminMatches.length ? (
                  <EditorNotice kind="info">Nenhuma partida encontrada.</EditorNotice>
                ) : null}

                {adminMatches.map((match) => (
                  <article
                    className={`editor-admin-match${match.ignored ? " ignored" : ""}`}
                    key={match.dbId}
                  >
                    <div className="editor-admin-match-heading">
                      <div>
                        <strong>Partida #{match.matchId}</strong>
                        <span>
                          {new Date(match.playedAt).toLocaleString("pt-BR")}
                          {match.winner ? ` · vencedor: ${match.winner}` : ""}
                        </span>
                      </div>

                      <button
                        type="button"
                        className={match.ignored ? "editor-secondary-button" : "editor-danger-button"}
                        disabled={Boolean(savingTarget)}
                        onClick={() => void toggleIgnoredMatch(match)}
                      >
                        {savingTarget === `admin:${match.dbId}` ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : match.ignored ? (
                          <PlayCircle size={16} />
                        ) : (
                          <PauseCircle size={16} />
                        )}
                        {match.ignored ? "Restaurar" : "Ignorar"}
                      </button>
                    </div>

                    <div className="editor-admin-match-players">
                      {match.players.map((entry, index) => (
                        <span key={`${match.dbId}:${index}`}>
                          {entry.winner ? "🏆 " : ""}
                          {entry.player}
                          {entry.deck ? ` — ${entry.deck}` : ""}
                        </span>
                      ))}
                    </div>

                    {match.ignored ? (
                      <p className="editor-field-hint">
                        Ignorada{match.reason ? ` · ${match.reason}` : ""}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
                </>
              ) : (
                <AdminTagsPanel
                  token={token}
                  playerId={sessionData.player.id}
                  usage={sessionData.keyruneUsage}
                  disabled={Boolean(savingTarget)}
                  onNotice={(kind, message) => setNotice({ kind, text: message })}
                />
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
                  disabled={Boolean(savingTarget)}
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
      <dialog ref={deleteDialogRef} className="editor-delete-dialog" aria-labelledby="editor-delete-title"
        aria-describedby="editor-delete-description"
        onCancel={(event) => { if (savingTarget) event.preventDefault(); else setDeleteDeckTarget(""); }}
        onClose={() => { if (!savingTarget) setDeleteDeckTarget(""); }}>
        <h2 id="editor-delete-title">Excluir {deleteDeckTarget}?</h2>
        <p id="editor-delete-description">O deck sairá da sua área e do catálogo disponível. Partidas e estatísticas antigas serão preservadas. A administração poderá recuperá-lo pela planilha. Alterações não salvas serão descartadas.</p>
        <label className="editor-field">
          <span>Digite o nome do deck para confirmar</span>
          <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} disabled={Boolean(savingTarget)} autoComplete="off" />
        </label>
        {notice?.kind === "error" ? <EditorNotice kind="error">{notice.text}</EditorNotice> : null}
        <div className="editor-heading-actions">
          <button type="button" className="editor-secondary-button" autoFocus disabled={Boolean(savingTarget)} onClick={() => setDeleteDeckTarget("")}>Cancelar</button>
          <button type="button" className="editor-danger-button" disabled={Boolean(savingTarget) || deleteConfirmation.trim() !== deleteDeckTarget}
            onClick={() => void deleteDeck()}>{savingTarget ? <LoaderCircle size={17} className="spin" /> : <Trash2 size={17} />}
            {savingTarget ? "Excluindo..." : "Confirmar exclusão"}</button>
        </div>
      </dialog>
    </main>
  );
}
