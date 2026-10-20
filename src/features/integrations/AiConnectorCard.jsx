import React from "react";
import api, { BACKEND_URL } from "../../core/api/client.js";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";
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
        Gere uma URL para conectar a extensão AI Engineering Fluency (AIEF) ao Andromeda e registrar
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
        connectorUrl={connectorUrl}
        healthUrl={`${BACKEND_URL}/connector/${orgSlug}/health`}
      />

      {confirmRegen && (
        <ConfirmDialog
          open
          onOpenChange={setConfirmRegen}
          eyebrow="regenerar token"
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

function TutorialStep({ n, title, children }) {
  return (
    <div className="integration-tutorial-step">
      <span className="integration-tutorial-step-num">{n}</span>
      <div className="integration-tutorial-step-body">
        <p className="integration-tutorial-step-title">{title}</p>
        {children}
      </div>
    </div>
  );
}

/* Bloco de código copiável — o snippet de settings tem linhas longas demais
 * para caber no card, então rola na horizontal em vez de quebrar. */
function CopyBlock({ text, label = "Copiar" }) {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border-line bg-bg-deep rounded-btn mt-1 flex items-start gap-2 border p-2">
      <pre className="text-fg-muted m-0 min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-pre">
        {text}
      </pre>
      <button
        type="button"
        className="btn btn-ghost min-h-[44px] shrink-0 md:min-h-0"
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
      className="text-accent font-mono text-xs underline decoration-dotted underline-offset-2"
    >
      {children}
    </a>
  );
}

function TutorialDisclosure({ summary, children }) {
  return (
    <details className="border-line mt-3 border-t pt-2">
      <summary className="text-fg font-mono text-xs tracking-wide uppercase">{summary}</summary>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </details>
  );
}

function AiConnectorTutorial({ connectorUrl, healthUrl }) {
  const endpoint = connectorUrl || "<GERE A URL ACIMA E COLE AQUI>";
  const settingsSnippet = JSON.stringify(
    {
      "aiEngineeringFluency.backend.enabled": true,
      "aiEngineeringFluency.backend.backend": "sharingServer",
      "aiEngineeringFluency.backend.sharingServer.enabled": true,
      "aiEngineeringFluency.backend.sharingServer.endpointUrl": endpoint,
      "aiEngineeringFluency.backend.sharingProfile": "teamAnonymized",
      "aiEngineeringFluency.backend.shareWithTeam": true,
      "aiEngineeringFluency.backend.datasetId": "default",
    },
    null,
    2,
  );

  return (
    <div className="integration-tutorial">
      <p className="integration-tutorial-heading">Como configurar</p>

      <div className="integration-tutorial-steps">
        <TutorialStep n={1} title="Instale a extensão">
          <p className="integration-tutorial-step-desc">
            <strong>AI Engineering Fluency</strong>, publicada como{" "}
            <code>RobBos.ai-engineering-fluency</code>.{" "}
            <TutorialLink href={MARKETPLACE_URL}>VS Code Marketplace ↗</TutorialLink>
            {" · "}
            <TutorialLink href={OPENVSX_URL}>Open VSX ↗</TutorialLink>
            {" · "}
            <TutorialLink href={UPSTREAM_SETUP_URL}>docs do projeto ↗</TutorialLink>
          </p>
        </TutorialStep>

        <TutorialStep n={2} title="Entre com o GitHub no editor">
          <p className="integration-tutorial-step-desc">
            <kbd>Ctrl+Shift+P</kbd> → <em>AI Engineering Fluency: Authenticate with GitHub</em> (ou
            use o login GitHub nativo do editor). Sem essa sessão a extensão{" "}
            <strong>pula o envio em silêncio</strong>, mesmo com tudo mais configurado.
          </p>
          <p className="integration-tutorial-step-desc">
            O Andromeda não usa essa sessão para autenticar — quem identifica você é o token
            embutido na URL. Ela só libera o envio na extensão.
          </p>
        </TutorialStep>

        <TutorialStep n={3} title="Cole as configurações no settings.json">
          <p className="integration-tutorial-step-desc">
            <kbd>Ctrl+Shift+P</kbd> → <em>Preferences: Open User Settings (JSON)</em> e acrescente
            as chaves abaixo.
            {connectorUrl ? " A URL gerada já veio preenchida." : ""}
          </p>
          <CopyBlock text={settingsSnippet} label="Copiar JSON" />
          <p className="text-warn mt-1 font-mono text-xs">
            <code>backend.enabled</code> é obrigatório apesar do nome: é o switch global de envio da
            extensão (herança do backend Azure Storage). Sem ele o perfil é inferido como{" "}
            <code>off</code> e nada sai da máquina. O Andromeda não usa Azure Storage — nenhum dado
            vai para a nuvem da Microsoft.
          </p>
        </TutorialStep>

        <TutorialStep n={4} title="Recarregue a janela">
          <p className="integration-tutorial-step-desc">
            <kbd>Ctrl+Shift+P</kbd> → <em>Developer: Reload Window</em>. O agendador de
            sincronização só é criado na ativação da extensão.
          </p>
        </TutorialStep>

        <TutorialStep n={5} title="Confirme que os dados chegaram">
          <p className="integration-tutorial-step-desc">
            O conector responde em{" "}
            <TutorialLink href={healthUrl}>
              <code>{healthUrl}</code> ↗
            </TutorialLink>{" "}
            com <code>&#123;"status":"ok"&#125;</code>. Depois force uma coleta com{" "}
            <em>AI Engineering Fluency: Refresh Token Usage</em> e acompanhe o painel{" "}
            <strong>Output → AI Engineering Fluency</strong>.
          </p>
          <p className="integration-tutorial-step-desc">
            Os registros caem em <strong>Uso de IA</strong> em alguns minutos — a extensão envia
            resumos diários (tokens, interações, modelo, editor e o Fluency Score), nunca prompts ou
            complementos.
          </p>
        </TutorialStep>
      </div>

      <TutorialDisclosure summary="Outras IDEs">
        <p className="integration-tutorial-step-desc">
          As chaves do <code>settings.json</code> são{" "}
          <strong>as mesmas em qualquer fork Chromium do VS Code</strong> — muda só como se instala.
          Para abrir o arquivo de configurações em qualquer um deles: <kbd>Ctrl+Shift+P</kbd> →{" "}
          <em>Preferences: Open User Settings (JSON)</em>.
        </p>
        <div className="flex flex-col">
          {IDE_TARGETS.map((target) => (
            <div
              key={target.name}
              className="border-line flex flex-col gap-0.5 border-b py-1 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <span className="text-fg w-36 shrink-0 font-mono text-xs">{target.name}</span>
              <code className="text-fg-muted font-mono text-xs">{target.cmd}</code>
            </div>
          ))}
        </div>
        <p className="integration-tutorial-step-desc">
          Forks costumam resolver extensões pelo{" "}
          <TutorialLink href={OPENVSX_URL}>Open VSX</TutorialLink> em vez do Marketplace da
          Microsoft. Se o comando acima falhar, instale pela UI do editor procurando por “AI
          Engineering Fluency”.
        </p>
        <p className="integration-tutorial-step-desc">
          <strong>Sem suporte para o Andromeda:</strong> JetBrains (IntelliJ, Rider, PyCharm,
          WebStorm…) e Visual Studio 2022 têm plugin próprio da AIEF, mas sem envio a um sharing
          server documentado. O CLI (<code>npx @rajbos/ai-engineering-fluency</code>) só analisa
          dados locais e não faz upload. Nesses ambientes, mantenha um editor da lista acima aberto
          para a coleta acontecer.
        </p>
      </TutorialDisclosure>

      <TutorialDisclosure summary="Não funcionou?">
        <p className="integration-tutorial-step-desc">
          Abra <strong>Output → AI Engineering Fluency</strong> e procure a mensagem:
        </p>
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
            <code>sharingServer.enabled</code> ou <code>sharingServer.endpointUrl</code> ausente.
          </li>
          <li>
            <code>401</code> no upload → token revogado, expirado ou URL de outra organização: gere
            um novo token acima.
          </li>
        </ul>
        <p className="integration-tutorial-step-desc">
          Regras que costumam confundir: o fechamento é <strong>por dia (UTC)</strong>, então o dia
          corrente só completa depois; e forks que não incluem o provedor de autenticação GitHub da
          Microsoft (caso do VSCodium puro) não conseguem o token do passo 2 — use VS Code, Cursor
          ou Windsurf.
        </p>
        <p className="integration-tutorial-step-desc">
          Com <code>sharingProfile: teamAnonymized</code> o Andromeda recebe workspace e máquina
          hasheados e sem nome. Para guardar os nomes, use <code>teamPseudonymous</code> junto de{" "}
          <code>shareWorkspaceMachineNames: true</code> — só faça isso se a organização aceitar
          receber nomes de máquina e de pasta de trabalho.
        </p>
      </TutorialDisclosure>
    </div>
  );
}
