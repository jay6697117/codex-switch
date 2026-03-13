package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"
	"codex-switch/internal/switching"

	"github.com/google/uuid"
)

var (
	ErrOAuthCancelled     = errors.New("oauth cancelled")
	ErrOAuthTimedOut      = errors.New("oauth timed out")
	ErrOAuthStateMismatch = errors.New("oauth state mismatch")
)

const (
	defaultIssuerURL = "https://auth.openai.com"
	defaultClientID  = "app_EMoamEEZ73f0CkXaXp7hrann"
)

type OAuthLoginInfo = contracts.OAuthLoginInfo

type OAuthResult struct {
	IDToken      string
	AccessToken  string
	RefreshToken string
	Email        *string
	AccountID    *string
}

type PendingLogin interface {
	Wait(context.Context) (OAuthResult, error)
	Cancel()
}

type LoginStarter interface {
	Start(context.Context, string) (contracts.OAuthLoginInfo, PendingLogin, error)
}

type Service struct {
	repository  accounts.Repository
	authStore   switching.AuthFileStore
	starter     LoginStarter
	now         func() time.Time
	idGenerator func() string

	mu      sync.Mutex
	pending *pendingLogin
}

type pendingLogin struct {
	accountName string
	login       PendingLogin
}

func NewService(
	repository accounts.Repository,
	authStore switching.AuthFileStore,
	starter LoginStarter,
) *Service {
	return &Service{
		repository:  repository,
		authStore:   authStore,
		starter:     starter,
		now:         time.Now().UTC,
		idGenerator: uuid.NewString,
	}
}

func (s *Service) StartLogin(ctx context.Context, accountName string) (contracts.OAuthLoginInfo, error) {
	normalizedName := strings.TrimSpace(accountName)
	if normalizedName == "" {
		return contracts.OAuthLoginInfo{}, contracts.AppError{Code: "oauth.name_required"}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pending != nil {
		s.pending.login.Cancel()
		s.pending = nil
	}

	info, login, err := s.starter.Start(ctx, normalizedName)
	if err != nil {
		return contracts.OAuthLoginInfo{}, wrapOAuthError(err, "oauth.start_failed")
	}

	s.pending = &pendingLogin{
		accountName: normalizedName,
		login:       login,
	}

	return info, nil
}

func (s *Service) CompleteLogin(ctx context.Context) (contracts.AccountsSnapshot, error) {
	s.mu.Lock()
	pending := s.pending
	s.pending = nil
	s.mu.Unlock()

	if pending == nil {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "oauth.no_pending_login"}
	}

	result, err := pending.login.Wait(ctx)
	if err != nil {
		return contracts.AccountsSnapshot{}, mapPendingError(err)
	}

	store, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "oauth.persist_failed"}
	}

	for _, account := range store.Accounts {
		if account.DisplayName == pending.accountName {
			return contracts.AccountsSnapshot{}, contracts.AppError{Code: "account.name_conflict"}
		}
	}

	now := s.now()
	account := accounts.AccountRecord{
		ID:          s.idGenerator(),
		DisplayName: pending.accountName,
		Email:       dereferenceString(result.Email),
		Auth: accounts.AccountAuth{
			Kind: "chatgpt",
			ChatGPT: &accounts.ChatGPTCredentials{
				IDToken:      result.IDToken,
				AccessToken:  result.AccessToken,
				RefreshToken: result.RefreshToken,
				AccountID:    copyString(result.AccountID),
			},
		},
		CreatedAt:  now,
		UpdatedAt:  now,
		LastUsedAt: &now,
	}

	previousAuth, err := s.authStore.ReadCurrent(ctx)
	if err != nil {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "oauth.persist_failed"}
	}

	store.Accounts = append(store.Accounts, account)
	store.ActiveAccountID = stringValuePointer(account.ID)

	if err := s.authStore.Write(ctx, buildChatGPTAuthFile(account, now)); err != nil {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "oauth.persist_failed"}
	}

	if err := s.repository.Save(ctx, store); err != nil {
		_ = s.authStore.Restore(ctx, previousAuth)
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "oauth.persist_failed"}
	}

	return accounts.SnapshotFromStore(store), nil
}

func (s *Service) CancelLogin(context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pending == nil {
		return nil
	}

	s.pending.login.Cancel()
	s.pending = nil
	return nil
}

// ImportFromFile 从 auth.json 文件导入账户
func (s *Service) ImportFromFile(ctx context.Context, input contracts.ImportFromFileInput) (contracts.AccountsSnapshot, error) {
	normalizedName := strings.TrimSpace(input.AccountName)
	if normalizedName == "" {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "oauth.name_required"}
	}

	filePath := strings.TrimSpace(input.FilePath)
	if filePath == "" {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "auth.file_invalid"}
	}

	// 读取并解析 auth.json 文件
	content, err := os.ReadFile(filePath)
	if err != nil {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "auth.import_failed"}
	}

	var authFile switching.AuthFile
	if err := json.Unmarshal(content, &authFile); err != nil {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "auth.file_invalid"}
	}

	// 判断文件中包含的认证类型
	hasChatGPTTokens := authFile.Tokens != nil && authFile.Tokens.RefreshToken != ""
	hasAPIKey := authFile.OpenAIAPIKey != nil && *authFile.OpenAIAPIKey != ""

	if !hasChatGPTTokens && !hasAPIKey {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "auth.file_empty"}
	}

	store, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "auth.import_failed"}
	}

	// 检查名称冲突
	for _, account := range store.Accounts {
		if account.DisplayName == normalizedName {
			return contracts.AccountsSnapshot{}, contracts.AppError{Code: "account.name_conflict"}
		}
	}

	now := s.now()
	account := accounts.AccountRecord{
		ID:          s.idGenerator(),
		DisplayName: normalizedName,
		CreatedAt:   now,
		UpdatedAt:   now,
		LastUsedAt:  &now,
	}

	if hasChatGPTTokens {
		// ChatGPT token 认证
		account.Auth = accounts.AccountAuth{
			Kind: "chatgpt",
			ChatGPT: &accounts.ChatGPTCredentials{
				IDToken:      authFile.Tokens.IDToken,
				AccessToken:  authFile.Tokens.AccessToken,
				RefreshToken: authFile.Tokens.RefreshToken,
				AccountID:    copyString(authFile.Tokens.AccountID),
			},
		}

		// 尝试从 ID Token 中解析 email
		email, _ := parseIDTokenClaims(authFile.Tokens.IDToken)
		if email != nil {
			account.Email = *email
		}
	} else {
		// API Key 认证
		account.Auth = accounts.AccountAuth{
			Kind: "apiKey",
			APIKey: &accounts.APIKeyCredentials{
				APIKey: *authFile.OpenAIAPIKey,
			},
		}
	}

	// 备份当前 auth 文件
	previousAuth, err := s.authStore.ReadCurrent(ctx)
	if err != nil {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "auth.import_failed"}
	}

	store.Accounts = append(store.Accounts, account)
	store.ActiveAccountID = stringValuePointer(account.ID)

	// 将 auth.json 写入 Codex home 目录
	if hasChatGPTTokens {
		if err := s.authStore.Write(ctx, buildChatGPTAuthFile(account, now)); err != nil {
			return contracts.AccountsSnapshot{}, contracts.AppError{Code: "auth.import_failed"}
		}
	} else {
		apiKeyValue := *authFile.OpenAIAPIKey
		if err := s.authStore.Write(ctx, switching.AuthFile{
			OpenAIAPIKey: &apiKeyValue,
		}); err != nil {
			return contracts.AccountsSnapshot{}, contracts.AppError{Code: "auth.import_failed"}
		}
	}

	// 保存 accounts 仓库
	if err := s.repository.Save(ctx, store); err != nil {
		_ = s.authStore.Restore(ctx, previousAuth)
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "auth.import_failed"}
	}

	return accounts.SnapshotFromStore(store), nil
}

type LocalStarterConfig struct {
	IssuerURL   string
	ClientID    string
	DefaultPort int
	Timeout     time.Duration
	HTTPClient  *http.Client
}

type LocalStarter struct {
	issuerURL   string
	clientID    string
	defaultPort int
	timeout     time.Duration
	httpClient  *http.Client
}

func NewLocalStarter(config LocalStarterConfig) *LocalStarter {
	timeout := config.Timeout
	if timeout <= 0 {
		timeout = 5 * time.Minute
	}

	defaultPort := config.DefaultPort
	if defaultPort == 0 {
		defaultPort = 1455
	}

	client := config.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	return &LocalStarter{
		issuerURL:   strings.TrimRight(config.IssuerURL, "/"),
		clientID:    config.ClientID,
		defaultPort: defaultPort,
		timeout:     timeout,
		httpClient:  client,
	}
}

func DefaultLocalStarter() *LocalStarter {
	return NewLocalStarter(LocalStarterConfig{
		IssuerURL: defaultIssuerURL,
		ClientID:  defaultClientID,
	})
}

func (s *LocalStarter) Start(_ context.Context, _ string) (contracts.OAuthLoginInfo, PendingLogin, error) {
	pkce, err := generatePKCE()
	if err != nil {
		return contracts.OAuthLoginInfo{}, nil, err
	}

	state, err := randomBase64(32)
	if err != nil {
		return contracts.OAuthLoginInfo{}, nil, err
	}

	listener, err := listenWithFallback(s.defaultPort)
	if err != nil {
		return contracts.OAuthLoginInfo{}, nil, err
	}

	var (
		server   *http.Server
		timer    *time.Timer
		resultCh = make(chan pendingOutcome, 1)
		once     sync.Once
	)

	finish := func(outcome pendingOutcome) {
		once.Do(func() {
			if timer != nil {
				timer.Stop()
			}
			if server != nil {
				_ = server.Close()
			}
			_ = listener.Close()
			resultCh <- outcome
			close(resultCh)
		})
	}

	callbackPort := listener.Addr().(*net.TCPAddr).Port
	redirectURI := fmt.Sprintf("http://localhost:%d/auth/callback", callbackPort)
	info := contracts.OAuthLoginInfo{
		AuthURL:      buildAuthorizeURL(s.issuerURL, s.clientID, redirectURI, pkce.challenge, state),
		CallbackPort: callbackPort,
		Pending:      true,
	}

	server = &http.Server{
		Handler: http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.URL.Path != "/auth/callback" {
				http.NotFound(writer, request)
				return
			}

			if request.URL.Query().Get("state") != state {
				http.Error(writer, "state mismatch", http.StatusBadRequest)
				go finish(pendingOutcome{err: ErrOAuthStateMismatch})
				return
			}

			code := strings.TrimSpace(request.URL.Query().Get("code"))
			if code == "" {
				http.Error(writer, "missing authorization code", http.StatusBadRequest)
				go finish(pendingOutcome{err: fmt.Errorf("oauth callback missing code")})
				return
			}

			result, exchangeErr := s.exchangeCode(request.Context(), code, redirectURI, pkce.verifier)
			if exchangeErr != nil {
				http.Error(writer, "token exchange failed", http.StatusInternalServerError)
				go finish(pendingOutcome{err: exchangeErr})
				return
			}

			writer.Header().Set("Content-Type", "text/html; charset=utf-8")
			writer.WriteHeader(http.StatusOK)
			_, _ = writer.Write([]byte(successHTML))
			go finish(pendingOutcome{result: result})
		}),
	}

	timer = time.AfterFunc(s.timeout, func() {
		finish(pendingOutcome{err: ErrOAuthTimedOut})
	})

	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			finish(pendingOutcome{err: err})
		}
	}()

	return info, &localPendingLogin{
		resultCh: resultCh,
		cancel: func() {
			finish(pendingOutcome{err: ErrOAuthCancelled})
		},
	}, nil
}

func listenWithFallback(defaultPort int) (net.Listener, error) {
	primaryAddress := fmt.Sprintf("127.0.0.1:%d", defaultPort)
	listener, err := net.Listen("tcp", primaryAddress)
	if err == nil {
		return listener, nil
	}

	return net.Listen("tcp", "127.0.0.1:0")
}

type tokenExchangeResponse struct {
	IDToken      string `json:"id_token"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type pendingOutcome struct {
	result OAuthResult
	err    error
}

type localPendingLogin struct {
	resultCh <-chan pendingOutcome
	cancel   func()
}

func (l *localPendingLogin) Wait(ctx context.Context) (OAuthResult, error) {
	select {
	case <-ctx.Done():
		return OAuthResult{}, ctx.Err()
	case outcome, ok := <-l.resultCh:
		if !ok {
			return OAuthResult{}, ErrOAuthCancelled
		}
		return outcome.result, outcome.err
	}
}

func (l *localPendingLogin) Cancel() {
	l.cancel()
}

func (s *LocalStarter) exchangeCode(
	ctx context.Context,
	code string,
	redirectURI string,
	codeVerifier string,
) (OAuthResult, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", s.clientID)
	form.Set("code_verifier", codeVerifier)

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("%s/oauth/token", s.issuerURL),
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return OAuthResult{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	response, err := s.httpClient.Do(request)
	if err != nil {
		return OAuthResult{}, err
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return OAuthResult{}, fmt.Errorf("oauth token exchange failed with status %d", response.StatusCode)
	}

	var payload tokenExchangeResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return OAuthResult{}, err
	}

	email, accountID := parseIDTokenClaims(payload.IDToken)

	return OAuthResult{
		IDToken:      payload.IDToken,
		AccessToken:  payload.AccessToken,
		RefreshToken: payload.RefreshToken,
		Email:        email,
		AccountID:    accountID,
	}, nil
}

func buildAuthorizeURL(
	issuerURL string,
	clientID string,
	redirectURI string,
	codeChallenge string,
	state string,
) string {
	query := url.Values{}
	query.Set("response_type", "code")
	query.Set("client_id", clientID)
	query.Set("redirect_uri", redirectURI)
	query.Set("scope", "openid profile email offline_access")
	query.Set("code_challenge", codeChallenge)
	query.Set("code_challenge_method", "S256")
	query.Set("id_token_add_organizations", "true")
	query.Set("codex_cli_simplified_flow", "true")
	query.Set("state", state)
	query.Set("originator", "codex_cli_go")

	return fmt.Sprintf("%s/oauth/authorize?%s", issuerURL, query.Encode())
}

func wrapOAuthError(err error, fallbackCode string) error {
	var appErr contracts.AppError
	if errors.As(err, &appErr) {
		return appErr
	}

	return contracts.AppError{Code: fallbackCode}
}

func mapPendingError(err error) error {
	switch {
	case errors.Is(err, ErrOAuthCancelled):
		return contracts.AppError{Code: "oauth.cancelled"}
	case errors.Is(err, ErrOAuthTimedOut):
		return contracts.AppError{Code: "oauth.timeout"}
	case errors.Is(err, ErrOAuthStateMismatch):
		return contracts.AppError{Code: "oauth.state_mismatch"}
	default:
		return contracts.AppError{Code: "oauth.complete_failed"}
	}
}

func buildChatGPTAuthFile(account accounts.AccountRecord, now time.Time) switching.AuthFile {
	return switching.AuthFile{
		Tokens: &switching.TokenData{
			IDToken:      account.Auth.ChatGPT.IDToken,
			AccessToken:  account.Auth.ChatGPT.AccessToken,
			RefreshToken: account.Auth.ChatGPT.RefreshToken,
			AccountID:    copyString(account.Auth.ChatGPT.AccountID),
		},
		LastRefresh: &now,
	}
}

type pkceCodes struct {
	verifier  string
	challenge string
}

func generatePKCE() (pkceCodes, error) {
	verifier, err := randomBase64(64)
	if err != nil {
		return pkceCodes{}, err
	}

	sum := sha256.Sum256([]byte(verifier))
	return pkceCodes{
		verifier:  verifier,
		challenge: base64.RawURLEncoding.EncodeToString(sum[:]),
	}, nil
}

func randomBase64(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func parseIDTokenClaims(idToken string) (*string, *string) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, nil
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, nil
	}

	var decoded struct {
		Email string `json:"email"`
		Auth  struct {
			AccountID string `json:"chatgpt_account_id"`
		} `json:"https://api.openai.com/auth"`
	}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, nil
	}

	var email *string
	if decoded.Email != "" {
		email = stringValuePointer(decoded.Email)
	}

	var accountID *string
	if decoded.Auth.AccountID != "" {
		accountID = stringValuePointer(decoded.Auth.AccountID)
	}

	return email, accountID
}

func copyString(value *string) *string {
	if value == nil {
		return nil
	}

	copyValue := *value
	return &copyValue
}

func stringValuePointer(value string) *string {
	return &value
}

func dereferenceString(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

const successHTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Login Successful</title></head>
<body><h1>Login Successful</h1><p>You can close this window and return to Codex Switcher.</p></body>
</html>`
