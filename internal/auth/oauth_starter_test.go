package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLocalStarterWaitsForCallbackAndExchangesTokens(t *testing.T) {
	t.Parallel()

	issuer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/oauth/token", r.URL.Path)
		require.NoError(t, json.NewEncoder(w).Encode(map[string]string{
			"id_token":      fakeJWT(t, `{"email":"work@example.com","https://api.openai.com/auth":{"chatgpt_account_id":"acct-openai"}}`),
			"access_token":  "access-token",
			"refresh_token": "refresh-token",
		}))
	}))
	defer issuer.Close()

	starter := NewLocalStarter(LocalStarterConfig{
		IssuerURL:   issuer.URL,
		ClientID:    "client-123",
		DefaultPort: 0,
		Timeout:     2 * time.Second,
	})

	info, pending, err := starter.Start(context.Background(), "Work Account")
	require.NoError(t, err)
	require.Contains(t, info.AuthURL, "redirect_uri=")

	callbackURL := callbackURLFromInfo(t, info)
	response, err := http.Get(callbackURL)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)

	result, err := pending.Wait(context.Background())
	require.NoError(t, err)
	require.Equal(t, "access-token", result.AccessToken)
	require.Equal(t, "refresh-token", result.RefreshToken)
	require.Equal(t, "work@example.com", dereference(result.Email))
	require.Equal(t, "acct-openai", dereference(result.AccountID))
}

func TestLocalStarterRejectsStateMismatch(t *testing.T) {
	t.Parallel()

	starter := NewLocalStarter(LocalStarterConfig{
		IssuerURL:   "https://auth.example.com",
		ClientID:    "client-123",
		DefaultPort: 0,
		Timeout:     2 * time.Second,
	})

	info, pending, err := starter.Start(context.Background(), "Work Account")
	require.NoError(t, err)

	callbackURL := callbackURLFromInfoWithState(t, info, "wrong-state")
	response, err := http.Get(callbackURL)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, response.StatusCode)

	_, err = pending.Wait(context.Background())
	require.ErrorIs(t, err, ErrOAuthStateMismatch)
}

func TestLocalStarterTimesOutWhenNoCallbackArrives(t *testing.T) {
	t.Parallel()

	starter := NewLocalStarter(LocalStarterConfig{
		IssuerURL:   "https://auth.example.com",
		ClientID:    "client-123",
		DefaultPort: 0,
		Timeout:     50 * time.Millisecond,
	})

	_, pending, err := starter.Start(context.Background(), "Work Account")
	require.NoError(t, err)

	_, err = pending.Wait(context.Background())
	require.ErrorIs(t, err, ErrOAuthTimedOut)
}

func TestLocalStarterFallsBackWhenDefaultPortIsBusy(t *testing.T) {
	t.Parallel()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer listener.Close()
	busyPort := listener.Addr().(*net.TCPAddr).Port

	starter := NewLocalStarter(LocalStarterConfig{
		IssuerURL:   "https://auth.example.com",
		ClientID:    "client-123",
		DefaultPort: busyPort,
		Timeout:     2 * time.Second,
	})

	info, pending, err := starter.Start(context.Background(), "Work Account")
	require.NoError(t, err)
	require.NotEqual(t, busyPort, info.CallbackPort)
	pending.Cancel()
	_, err = pending.Wait(context.Background())
	require.ErrorIs(t, err, ErrOAuthCancelled)
}

func callbackURLFromInfo(t *testing.T, info OAuthLoginInfo) string {
	t.Helper()
	parsed, err := url.Parse(info.AuthURL)
	require.NoError(t, err)
	state := parsed.Query().Get("state")
	require.NotEmpty(t, state)

	return fmt.Sprintf("http://127.0.0.1:%d/auth/callback?code=good-code&state=%s", info.CallbackPort, url.QueryEscape(state))
}

func callbackURLFromInfoWithState(t *testing.T, info OAuthLoginInfo, state string) string {
	t.Helper()
	return fmt.Sprintf("http://127.0.0.1:%d/auth/callback?code=bad-code&state=%s", info.CallbackPort, url.QueryEscape(state))
}
