import React from "react";
import api, { BACKEND_URL } from "../../core/api/client.js";
import Disclosure from "../../core/ui/Disclosure.jsx";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";
import Tabs from "../../core/ui/Tabs.jsx";
import { IntegrationDataActions } from "./IntegrationDataActions.jsx";
import { useWipeAiUsageData } from "./hooks.js";

/**
 * @param {{ orgSlug: string, hasOrg: (code: string) => boolean }} props
 *   `hasOrg` é o predicado de permissão na organização (useIdentity) — os
 *   códigos CONNECTOR_TOKEN_MANAGE_* são ORG_ONLY.
 */
export function AiConnectorCard({ orgSlug, hasOrg }) {
  const limparIA = useWipeAiUsageData();
  /* O backend decide o escopo pelas permissoes do token; aqui so ajustamos o
   * texto do aviso para dizer a verdade sobre o que vai sumir. */
  const podeApagarDaOrg = hasOrg("CONNECTOR_TOKEN_MANAGE_ALL");
  // "empty" | "generated" | "existing" | "loading" | "error"
  const [uiState, setUiState] = React.useState("loading");
  const [existingTokenId, setExistingTokenId] = React.useState(null);
  const [rawToken, setRawToken] = React.useState(null);
  const [connectorUrl, setConnectorUrl] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [working, setWorking] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [confirmRegen, setConfirmRegen] = React.useState(false);

  const buildUrl = (token) => `${BACKEND_URL}/connector/${orgSlug}/${token}`;

  const fetchTokens = React.useCallback(async () => {
    setUiState("loading");
    setError(null);
    try {
      const data = await api.get("/v1/connector-tokens");
      const list = Array.isArray(data) ? data : (data?.content ?? []);
      if (list.length === 0) {
        setUiState("empty");
      } else {
        setExistingTokenId(list[0].id);
        setUiState("existing");
      }
    } catch (_) {
      setError("Não foi possível verificar os tokens.");
      setUiState("error");
    }
  }, []);

  React.useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleGenerate = React.useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await api.post("/v1/connector-tokens", {});
      const token = res.rawToken;
      setRawToken(token);
      setExistingTokenId(res.id);
      setConnectorUrl(buildUrl(token));
      setUiState("generated");
    } catch (_) {
      setError("Erro ao gerar o token. Tente novamente.");
    } finally {
      setWorking(false);
    }
  }, [orgSlug]);

  const handleRegen = React.useCallback(async () => {
    setWorking(true);
    setError(null);
    setConfirmRegen(false);
    try {
      if (existingTokenId) {
        await api.delete(`/v1/connector-tokens/${existingTokenId}`);
      }
      const res = await api.post("/v1/connector-tokens", {});
      const token = res.rawToken;
      setRawToken(token);
      setExistingTokenId(res.id);
      setConnectorUrl(buildUrl(token));
      setUiState("generated");
    } catch (_) {
      setError("Erro ao regenerar o token. Tente novamente.");
      setUiState("existing");
    } finally {
      setWorking(false);
    }
  }, [existingTokenId, orgSlug]);

  const handleCopy = React.useCallback(() => {
    if (!connectorUrl) return;
    navigator.clipboard.writeText(connectorUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [connectorUrl]);

  return (
    <div className="integration-card">
      {/* ── Card header ── */}
      <div className="integration-card-head">
        <div className="integration-card-icon" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1.5 7.5L12 2l10.5 5.5v9L12 22 1.5 16.5v-9Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M12 2v20M1.5 7.5l10.5 5.5 10.5-5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="integration-card-name">Extensão AI Engineering Fluency</span>
        <div className="integration-card-badges">
          {(uiState === "existing" || uiState === "generated") && (
            <span className="integration-status-badge is-connected">● URL gerada</span>
          )}
          {uiState === "empty" && (
            <span className="integration-status-badge is-disconnected">Não configurado</span>
          )}
        </div>
      </div>

      {/* ── Description ── */}
      <p className="integration-desc">
        Gere uma URL para conectar a extensão AI Engineering Fluency (AIEF) à Andrômeda e registrar
        métricas de uso de IA. Funciona no VS Code e em qualquer fork Chromium dele (Cursor,
        Windsurf, Trae, Kiro, Void).
      </p>

      {/* ── Token states ── */}
      {uiState === "loading" && <p className="mono integration-loading">Verificando tokens…</p>}

      {uiState === "error" && (
        <>
          <p className="mono integration-error" role="alert">
            {error}
          </p>
          <button className="btn min-h-[44px] md:min-h-0" onClick={fetchTokens}>
            Tentar novamente
          </button>
        </>
      )}

      {uiState === "empty" && (
        <>
          <div className="integration-actions">
            <button
              className="btn min-h-[44px] md:min-h-0"
              onClick={handleGenerate}
              disabled={working}
            >
              {working ? "Gerando…" : "Gerar URL →"}
            </button>
          </div>
          {error && (
            <p className="mono integration-error" style={{ marginTop: "var(--spacing-sm)" }}>
              {error}
            </p>
          )}
        </>
      )}

      {uiState === "generated" && (
        <>
          <div className="integration-url-row">
            <input
              className="integration-url-input"
              readOnly
              value={connectorUrl}
              onFocus={(e) => e.target.select()}
              aria-label="URL do conector"
            />
            <button
              className="btn min-h-[44px] md:min-h-0"
              onClick={handleCopy}
              style={{ whiteSpace: "nowrap" }}
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="integration-url-warn">
            Copie a URL antes de sair — ela não será exibida novamente.
          </p>
        </>
      )}

      {uiState === "existing" && (
        <>
          <div className="integration-actions">
            <button
              className="btn min-h-[44px] md:min-h-0"
              onClick={() => setConfirmRegen(true)}
              disabled={working}
            >
              {working ? "Gerando…" : "Gerar novo token →"}
            </button>
          </div>
          {error && (
            <p className="mono integration-error" style={{ marginTop: "var(--spacing-sm)" }}>
              {error}
            </p>
          )}
        </>
      )}

      {/* ── Tutorial — always visible below divider ── */}
      <AiConnectorTutorial
        initiallyOpen={uiState === "loading" ? null : uiState !== "existing"}
        connectorUrl={connectorUrl}
        healthUrl={`${BACKEND_URL}/connector/${orgSlug}/health`}
      />

      {confirmRegen && (
        <ConfirmDialog
          open
          onOpenChange={setConfirmRegen}
          eyebrow="Conector de IA"
          title={
            <>
              Gerar um <span className="ital accent">novo token</span>?
            </>
          }
          message={
            <>
              A configuração da extensão em <strong>todos os editores</strong> que usam esta URL vai
              parar de funcionar até você atualizar o <code>endpointUrl</code> neles.
            </>
          }
          confirmLabel="Confirmar →"
          danger
          onConfirm={handleRegen}
        />
      )}

      <IntegrationDataActions
        nome="Conector de IA"
        conectado
        confirmPhrase="APAGAR"
        onLimpar={() => limparIA.mutateAsync()}
        avisoLimpeza={
          <>
            {podeApagarDaOrg ? (
              <>
                O uso de IA de <strong>toda a organização</strong> será apagado: consumo diário,
                alocações e scores de fluência de todos os usuários.
              </>
            ) : (
              <>
                <strong>Somente os seus dados</strong> de uso de IA serão apagados — consumo,
                alocações e o seu score de fluência. Os dados dos outros usuários não são afetados.
              </>
            )}{" "}
            Ao contrário do Azure DevOps e do GitHub, estes dados{" "}
            <strong>não podem ser recuperados</strong>: eles chegam por upload da extensão, não por
            sincronização. Não há como desfazer.
          </>
        }
      />
    </div>
  );
}

/* ─── Tutorial de configuração da extensão AIEF ─────────────────────────────
 * Este bloco é a única documentação de setup que o dev vê, então ele precisa
 * bater com o que a extensão lê de fato. Três coisas que o tutorial antigo
 * errava:
 *   1. não existe `aief.serverUrl` — as chaves vivem em
 *      `aiEngineeringFluency.backend.*` (rajbos/ai-engineering-fluency,
 *      vscode-extension/src/backend/settings.ts);
 *   2. ligar só o sharing server não envia nada: `allowCloudSync` é
 *      `backend.enabled && sharingProfile !== "off"` e `inferSharingProfile()`
 *      devolve "off" quando `backend.enabled` é false — daí os dois estarem no
 *      snippet (o nome `backend.enabled` é legado do backend Azure Storage, que
 *      o Andromeda não usa);
 *   3. sem uma sessão GitHub no editor o upload é pulado em silêncio
 *      (`getGithubToken()` vazio em services/syncService.ts).
 * O Andromeda autentica pelo token no path, não pelo header Bearer que a
 * extensão manda — ver ConnectorTokenAuthFilter. */

const MARKETPLACE_URL =
  "https://marketplace.visualstudio.com/items?itemName=RobBos.ai-engineering-fluency";
const OPENVSX_URL = "https://open-vsx.org/extension/RobBos/ai-engineering-fluency";
const UPSTREAM_SETUP_URL =
  "https://github.com/rajbos/ai-engineering-fluency/blob/main/docs/sharing-server/README.md";

/* Forks Chromium suportados pela extensão. As chaves de configuração são as
 * mesmas em todos; só muda o binário de CLI usado para instalar. */
const IDE_TARGETS = [
  { name: "VS Code", cmd: "code --install-extension RobBos.ai-engineering-fluency" },
  {
    name: "VS Code Insiders",
    cmd: "code-insiders --install-extension RobBos.ai-engineering-fluency",
  },
  { name: "Cursor", cmd: "cursor --install-extension RobBos.ai-engineering-fluency" },
  { name: "Windsurf", cmd: "windsurf --install-extension RobBos.ai-engineering-fluency" },
  { name: "VSCodium", cmd: "codium --install-extension RobBos.ai-engineering-fluency" },
  { name: "Trae", cmd: "trae --install-extension RobBos.ai-engineering-fluency" },
  { name: "Kiro", cmd: "kiro --install-extension RobBos.ai-engineering-fluency" },
  { name: "Void", cmd: "void --install-extension RobBos.ai-engineering-fluency" },
];

const EDITOR_STORAGE_KEY = "andromeda_aief_editor";
const EDITOR_IDS = ["vscode", "forks", "jetbrains", "visualstudio", "cli"];

const FORK_TARGETS = IDE_TARGETS.slice(1);

/* JetBrains, Visual Studio e CLI: a AIEF tem versão deles, mas só a extensão do
 * VS Code envia para um servidor — e ela lê os logs desses ambientes na mesma máquina. */
const VIA_VSCODE =
  "Para enviar o uso daqui à Andrômeda, deixe a extensão do VS Code instalada, configurada com os passos abaixo e aberta na mesma máquina: é ela que lê os logs deste ambiente e faz o envio.";

function readStoredEditor() {
  try {
    return localStorage.getItem(EDITOR_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

function storeEditor(id) {
  try {
    localStorage.setItem(EDITOR_STORAGE_KEY, id);
  } catch (_) {
    /* storage bloqueado: a aba só deixa de ser lembrada */
  }
}

/* Passo do acordeão: número e título no <summary>, corpo recuado. */
function TutorialStep({ n, title, defaultOpen = false, children }) {
  return (
    <Disclosure
      defaultOpen={defaultOpen}
      className="border-line border-b"
      lead={
        <span
          aria-hidden="true"
          className="border-line text-fg-muted flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border font-mono text-xs"
        >
          {n}
        </span>
      }
      summary={
        <>
          <span className="sr-only">Passo {n}: </span>
          <span className="font-semibold">{title}</span>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-2 pr-1 pb-3 pl-[42px]">{children}</div>
    </Disclosure>
  );
}

/* Bloco de código copiável. O texto copiado é exatamente o exibido. A linha
 * longa rola dentro do <pre>; `min-w-0` em toda a cadeia flex impede que ele
 * empurre a largura da página. */
function CopyBlock({ text, label = "Copiar" }) {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border-line bg-bg-deep rounded-btn mt-1 flex min-w-0 flex-col gap-2 border p-2 sm:flex-row sm:items-start">
      <pre
        tabIndex={0}
        className="text-fg focus-visible:outline-accent m-0 min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-pre focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {text}
      </pre>
      <button
        type="button"
        className="btn btn-ghost min-h-[44px] min-w-[44px] shrink-0"
        onClick={copy}
      >
        {copied ? "Copiado!" : label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copiado!" : ""}
      </span>
    </div>
  );
}

function TutorialLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-text focus-visible:outline-accent inline-block py-1.5 font-mono text-xs underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </a>
  );
}

function Desc({ children }) {
  return <p className="text-fg-muted m-0 font-mono text-xs leading-normal">{children}</p>;
}

function InstallCommand({ cmd }) {
  return (
    <code className="text-fg bg-bg-deep rounded-btn block max-w-full overflow-x-auto px-2 py-1 font-mono text-xs whitespace-pre">
      {cmd}
    </code>
  );
}

function EditorTabs() {
  const [editor, setEditor] = React.useState(() => {
    const stored = readStoredEditor();
    return EDITOR_IDS.includes(stored) ? stored : "vscode";
  });
  const select = (id) => {
    setEditor(id);
    storeEditor(id);
  };

  const tabs = [
    {
      id: "vscode",
      label: "VS Code",
      panel: (
        <div className="flex flex-col gap-2">
          <Desc>
            <strong>AI Engineering Fluency</strong>, publicada como{" "}
            <code>RobBos.ai-engineering-fluency</code>.
          </Desc>
          <InstallCommand cmd={IDE_TARGETS[0].cmd} />
          <div className="flex flex-wrap gap-x-4">
            <TutorialLink href={MARKETPLACE_URL}>VS Code Marketplace ↗</TutorialLink>
            <TutorialLink href={OPENVSX_URL}>Open VSX ↗</TutorialLink>
            <TutorialLink href={UPSTREAM_SETUP_URL}>docs do projeto ↗</TutorialLink>
          </div>
        </div>
      ),
    },
    {
      id: "forks",
      label: "Forks: Cursor, Windsurf e outros",
      panel: (
        <div className="flex flex-col gap-2">
          <Desc>
            As chaves do <code>settings.json</code> são{" "}
            <strong>as mesmas em qualquer fork do VS Code</strong>; muda só como se instala. Para
            abrir as configurações em qualquer um deles: <kbd>Ctrl+Shift+P</kbd> →{" "}
            <em>Preferences: Open User Settings (JSON)</em>.
          </Desc>
          <ul className="m-0 flex list-none flex-col p-0">
            {FORK_TARGETS.map((target) => (
              <li
                key={target.name}
                className="border-line flex min-w-0 flex-col gap-0.5 border-b py-1 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <span className="text-fg w-36 shrink-0 font-mono text-xs">{target.name}</span>
                <code className="text-fg-muted min-w-0 font-mono text-xs break-all">
                  {target.cmd}
                </code>
              </li>
            ))}
          </ul>
          <Desc>
            Forks costumam resolver extensões pelo{" "}
            <TutorialLink href={OPENVSX_URL}>Open VSX</TutorialLink> em vez do Marketplace da
            Microsoft. Se o comando falhar, instale pela UI do editor procurando por “AI Engineering
            Fluency”.
          </Desc>
        </div>
      ),
    },
    {
      id: "jetbrains",
      label: "JetBrains",
      panel: (
        <div className="flex flex-col gap-2">
          <Desc>
            IntelliJ, Rider, PyCharm, WebStorm… O plugin <code>31580</code> da AIEF mostra os dados
            só localmente: <strong>ele não envia nada por conta própria</strong>.
          </Desc>
          <Desc>{VIA_VSCODE}</Desc>
        </div>
      ),
    },
    {
      id: "visualstudio",
      label: "Visual Studio",
      panel: (
        <div className="flex flex-col gap-2">
          <Desc>
            A extensão <code>RobBos.AIEngineeringFluency</code> do Visual Studio 2022 mostra os
            dados só localmente: <strong>ela não envia nada por conta própria</strong>.
          </Desc>
          <Desc>{VIA_VSCODE}</Desc>
        </div>
      ),
    },
    {
      id: "cli",
      label: "CLI",
      panel: (
        <div className="flex flex-col gap-2">
          <InstallCommand cmd="npx @rajbos/ai-engineering-fluency" />
          <Desc>
            O CLI só analisa os dados locais: <strong>ele não envia nada por conta própria</strong>.
          </Desc>
          <Desc>{VIA_VSCODE}</Desc>
        </div>
      ),
    },
  ];

  return <Tabs tabs={tabs} value={editor} onChange={select} label="Editor" />;
}

/* As sete chaves que a extensão lê, uma por linha, já com a vírgula final e sem
 * as chaves externas: o usuário cola logo depois da `{` do settings.json e o
 * arquivo continua válido (JSONC aceita a vírgula final). */
function buildSettingsSnippet(endpoint) {
  const entries = [
    ["aiEngineeringFluency.backend.enabled", true],
    ["aiEngineeringFluency.backend.backend", "sharingServer"],
    ["aiEngineeringFluency.backend.sharingServer.enabled", true],
    ["aiEngineeringFluency.backend.sharingServer.endpointUrl", endpoint],
    ["aiEngineeringFluency.backend.sharingProfile", "teamAnonymized"],
    ["aiEngineeringFluency.backend.shareWithTeam", true],
    ["aiEngineeringFluency.backend.datasetId", "default"],
  ];
  return entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
}

function AiConnectorTutorial({ initiallyOpen, connectorUrl, healthUrl }) {
  const endpoint = connectorUrl || "<GERE A URL ACIMA E COLE AQUI>";
  const settingsSnippet = buildSettingsSnippet(endpoint);

  /* aberto sem token, fechado com token; decidido uma vez, quando o estado do
   * token chega — depois disso só a pessoa mexe */
  const [open, setOpen] = React.useState(false);
  const decided = React.useRef(false);
  React.useEffect(() => {
    if (initiallyOpen === null || decided.current) return;
    decided.current = true;
    setOpen(initiallyOpen);
  }, [initiallyOpen]);

  return (
    <div className="integration-tutorial">
      <Disclosure
        open={open}
        onOpenChange={setOpen}
        summary="Como configurar no editor · 5 passos"
        summaryClassName="uppercase tracking-wide"
      >
        <div className="flex flex-col pt-1">
          <TutorialStep n={1} title="Instale a extensão" defaultOpen>
            <EditorTabs />
          </TutorialStep>

          <TutorialStep n={2} title="Entre com o GitHub no editor">
            <Desc>
              <kbd>Ctrl+Shift+P</kbd> → <em>AI Engineering Fluency: Authenticate with GitHub</em>{" "}
              (ou use o login GitHub nativo do editor). Sem essa sessão a extensão{" "}
              <strong>pula o envio em silêncio</strong>, mesmo com tudo mais configurado.
            </Desc>
            <Desc>
              A Andrômeda <strong>descarta o token do GitHub</strong> que a extensão envia e não o
              usa para autorizar nada: quem identifica você é o token embutido na URL. A sessão só
              libera o envio na extensão.
            </Desc>
          </TutorialStep>

          <TutorialStep n={3} title="Cole as configurações no settings.json">
            <Desc>
              <kbd>Ctrl+Shift+P</kbd> → <em>Preferences: Open User Settings (JSON)</em> e cole as
              linhas abaixo <strong>logo depois da </strong>
              <code>{"{"}</code>
              <strong> que abre o seu settings.json</strong>.
              {connectorUrl ? " A URL gerada já veio preenchida." : ""}
            </Desc>
            <CopyBlock text={settingsSnippet} label="Copiar linhas" />
            <p className="text-warn-text m-0 font-mono text-xs leading-normal">
              <code>backend.enabled</code> precisa estar ligado, apesar do nome: é a chave geral de
              envio da extensão. Sem ela, nada sai da máquina. A Andrômeda não usa Azure Storage;
              nenhum dado vai para a nuvem da Microsoft.
            </p>
          </TutorialStep>

          <TutorialStep n={4} title="Recarregue a janela">
            <Desc>
              <kbd>Ctrl+Shift+P</kbd> → <em>Developer: Reload Window</em>. O agendador de
              sincronização só é criado na ativação da extensão.
            </Desc>
          </TutorialStep>

          <TutorialStep n={5} title="Confirme que os dados chegaram">
            <Desc>
              O conector responde em{" "}
              <TutorialLink href={healthUrl}>
                <code className="break-all">{healthUrl}</code> ↗
              </TutorialLink>{" "}
              com <code>&#123;"status":"ok"&#125;</code>. Depois force uma coleta com{" "}
              <em>AI Engineering Fluency: Refresh Token Usage</em> e acompanhe o painel{" "}
              <strong>Output → AI Engineering Fluency</strong>.
            </Desc>
            <Desc>
              Os registros caem em <strong>Uso de IA</strong> em alguns minutos — a extensão envia
              resumos diários (tokens, interações, modelo, editor e o Fluency Score), nunca prompts
              ou complementos.
            </Desc>
          </TutorialStep>

          <Disclosure summary="Não funcionou?" summaryClassName="uppercase tracking-wide">
            <div className="flex flex-col gap-2 pb-2">
              <Desc>
                Abra <strong>Output → AI Engineering Fluency</strong> e procure a mensagem:
              </Desc>
              <ul className="text-fg-muted m-0 flex list-none flex-col gap-1 p-0 font-mono text-xs">
                <li>
                  <code>skipping (no GitHub token…)</code> → falta o passo 2.
                </li>
                <li>
                  <code>not starting timer (cloud sync disabled, profile: off)</code> → falta{" "}
                  <code>backend.enabled</code> ou <code>sharingProfile</code> no passo 3.
                </li>
                <li>
                  <code>not starting timer (backend not configured)</code> →{" "}
                  <code>sharingServer.enabled</code> ou <code>sharingServer.endpointUrl</code>{" "}
                  ausente.
                </li>
                <li>
                  <code>401</code> no upload → token revogado, expirado ou URL de outra organização:
                  gere um novo token acima.
                </li>
              </ul>
              <Desc>
                Duas pegadinhas: o dia fecha em <strong>UTC</strong>, então o dia de hoje só aparece
                completo depois; e forks sem o login do GitHub da Microsoft (como o VSCodium) não
                conseguem o token do passo 2. Use VS Code, Cursor ou Windsurf.
              </Desc>
              <Desc>
                Com <code>sharingProfile: teamAnonymized</code>, a Andrômeda recebe workspace e
                máquina sem nome (só um hash). Para receber os nomes, use{" "}
                <code>teamPseudonymous</code> com <code>shareWorkspaceMachineNames: true</code>, e
                só se a organização aceitar esses dados.
              </Desc>
            </div>
          </Disclosure>
        </div>
      </Disclosure>
    </div>
  );
}
