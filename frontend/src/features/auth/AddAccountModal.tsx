import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type OAuthPhase = "idle" | "starting" | "waiting" | "completing" | "cancelling";
export type ImportPhase = "idle" | "importing";
type ActiveTab = "oauth" | "import";

interface AddAccountModalProps {
  isOpen: boolean;
  phase: OAuthPhase;
  importPhase: ImportPhase;
  authUrl: string | null;
  errorCode: string | null;
  importFilePath: string | null;
  onClose: () => void | Promise<void>;
  onStart: (accountName: string) => Promise<void>;
  onOpenBrowserAgain: () => void;
  onComplete: () => Promise<void>;
  onCancel: () => Promise<void>;
  onSelectFile: () => Promise<void>;
  onImportFile: (accountName: string) => Promise<void>;
}

export function AddAccountModal({
  isOpen,
  phase,
  importPhase,
  authUrl,
  errorCode,
  importFilePath,
  onClose,
  onStart,
  onOpenBrowserAgain,
  onComplete,
  onCancel,
  onSelectFile,
  onImportFile,
}: AddAccountModalProps) {
  const { t } = useTranslation(["auth", "errors"]);
  const [accountName, setAccountName] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("oauth");

  useEffect(() => {
    if (!isOpen) {
      setAccountName("");
      setActiveTab("oauth");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const isOAuthWaiting = phase === "waiting" || phase === "completing" || phase === "cancelling";
  // 当 OAuth 正在进行中，禁止切换 Tab
  const canSwitchTab = !isOAuthWaiting && importPhase === "idle";

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        aria-labelledby="add-account-title"
        aria-modal="true"
        className="switch-dialog auth-dialog"
        role="dialog"
      >
        <div className="auth-dialog-header">
          <h3 id="add-account-title">{t("auth:title")}</h3>
          <button
            aria-label={t("auth:closeAction")}
            className="icon-button"
            onClick={() => {
              void onClose();
            }}
            type="button"
          >
            ×
          </button>
        </div>

        {/* Tab 切换栏 */}
        <div className="auth-tab-bar">
          <button
            className={`auth-tab-button ${activeTab === "oauth" ? "auth-tab-active" : ""}`}
            disabled={!canSwitchTab}
            onClick={() => setActiveTab("oauth")}
            type="button"
          >
            {t("auth:oauthTab")}
          </button>
          <button
            className={`auth-tab-button ${activeTab === "import" ? "auth-tab-active" : ""}`}
            disabled={!canSwitchTab}
            onClick={() => setActiveTab("import")}
            type="button"
          >
            {t("auth:importTab")}
          </button>
        </div>

        <div className="auth-dialog-body">
          {/* 账户名称输入（两个 Tab 共用） */}
          <div className="account-rename-block">
            <label className="account-field-label" htmlFor="oauth-account-name">
              {t("auth:nameLabel")}
            </label>
            <input
              aria-label={t("auth:nameLabel")}
              className="account-rename-input"
              disabled={isOAuthWaiting || importPhase === "importing"}
              id="oauth-account-name"
              onChange={(event) => setAccountName(event.target.value)}
              placeholder={t("auth:namePlaceholder")}
              type="text"
              value={accountName}
            />
          </div>

          {activeTab === "oauth" ? (
            /* OAuth Tab 内容 */
            <>
              {isOAuthWaiting ? (
                <div className="auth-waiting-panel">
                  <strong>{t("auth:waitingTitle")}</strong>
                  <p>{t("auth:waitingBody")}</p>
                  {authUrl ? <p className="auth-url-preview">{authUrl}</p> : null}
                </div>
              ) : (
                <p>{t("auth:idleBody")}</p>
              )}
            </>
          ) : (
            /* Import File Tab 内容 */
            <>
              <p>{t("auth:importIdleBody")}</p>
              <div className="account-rename-block">
                <label className="account-field-label" htmlFor="import-file-path">
                  {t("auth:importFileLabel")}
                </label>
                <div className="auth-file-picker">
                  <input
                    aria-label={t("auth:importFileLabel")}
                    className="account-rename-input auth-file-path-input"
                    disabled
                    id="import-file-path"
                    placeholder={t("auth:importFilePlaceholder")}
                    type="text"
                    value={importFilePath ?? ""}
                  />
                  <button
                    className="secondary-button"
                    disabled={importPhase === "importing"}
                    onClick={() => {
                      void onSelectFile();
                    }}
                    type="button"
                  >
                    {t("auth:browseAction")}
                  </button>
                </div>
              </div>
            </>
          )}

          {errorCode ? <p className="accounts-error-banner">{t(`errors:${errorCode}`)}</p> : null}
        </div>

        <div className="switch-dialog-actions">
          {activeTab === "oauth" ? (
            /* OAuth Tab 按钮 */
            isOAuthWaiting ? (
              <>
                <button className="secondary-button" onClick={onOpenBrowserAgain} type="button">
                  {t("auth:openBrowserAgain")}
                </button>
                <button
                  className="secondary-button"
                  disabled={phase === "cancelling"}
                  onClick={() => {
                    void onCancel();
                  }}
                  type="button"
                >
                  {phase === "cancelling" ? t("auth:cancellingAction") : t("auth:cancelLogin")}
                </button>
                <button
                  className="primary-button"
                  disabled={phase === "completing"}
                  onClick={() => {
                    void onComplete();
                  }}
                  type="button"
                >
                  {phase === "completing" ? t("auth:completingAction") : t("auth:completeAction")}
                </button>
              </>
            ) : (
              <>
                <button
                  className="secondary-button"
                  onClick={() => {
                    void onClose();
                  }}
                  type="button"
                >
                  {t("auth:cancelAction")}
                </button>
                <button
                  className="primary-button"
                  disabled={phase === "starting"}
                  onClick={() => {
                    void onStart(accountName);
                  }}
                  type="button"
                >
                  {phase === "starting" ? t("auth:startingAction") : t("auth:startAction")}
                </button>
              </>
            )
          ) : (
            /* Import File Tab 按钮 */
            <>
              <button
                className="secondary-button"
                onClick={() => {
                  void onClose();
                }}
                type="button"
              >
                {t("auth:cancelAction")}
              </button>
              <button
                className="primary-button"
                disabled={importPhase === "importing" || !importFilePath}
                onClick={() => {
                  void onImportFile(accountName);
                }}
                type="button"
              >
                {importPhase === "importing"
                  ? t("auth:importingAction")
                  : t("auth:importAction")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
