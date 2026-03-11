import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type OAuthPhase = "idle" | "starting" | "waiting" | "completing" | "cancelling";

interface AddAccountModalProps {
  isOpen: boolean;
  phase: OAuthPhase;
  authUrl: string | null;
  errorCode: string | null;
  onClose: () => void | Promise<void>;
  onStart: (accountName: string) => Promise<void>;
  onOpenBrowserAgain: () => void;
  onComplete: () => Promise<void>;
  onCancel: () => Promise<void>;
}

export function AddAccountModal({
  isOpen,
  phase,
  authUrl,
  errorCode,
  onClose,
  onStart,
  onOpenBrowserAgain,
  onComplete,
  onCancel,
}: AddAccountModalProps) {
  const { t } = useTranslation(["auth", "errors"]);
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setAccountName("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const isWaiting = phase === "waiting" || phase === "completing" || phase === "cancelling";

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

        <div className="auth-dialog-body">
          <div className="account-rename-block">
            <label className="account-field-label" htmlFor="oauth-account-name">
              {t("auth:nameLabel")}
            </label>
            <input
              aria-label={t("auth:nameLabel")}
              className="account-rename-input"
              disabled={isWaiting}
              id="oauth-account-name"
              onChange={(event) => setAccountName(event.target.value)}
              placeholder={t("auth:namePlaceholder")}
              type="text"
              value={accountName}
            />
          </div>

          {isWaiting ? (
            <div className="auth-waiting-panel">
              <strong>{t("auth:waitingTitle")}</strong>
              <p>{t("auth:waitingBody")}</p>
              {authUrl ? <p className="auth-url-preview">{authUrl}</p> : null}
            </div>
          ) : (
            <p>{t("auth:idleBody")}</p>
          )}

          {errorCode ? <p className="accounts-error-banner">{t(`errors:${errorCode}`)}</p> : null}
        </div>

        <div className="switch-dialog-actions">
          {isWaiting ? (
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
          )}
        </div>
      </div>
    </div>
  );
}
