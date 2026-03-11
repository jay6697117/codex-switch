package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type HTTPRefreshExchanger struct {
	issuerURL  string
	clientID   string
	httpClient *http.Client
}

func NewHTTPRefreshExchanger(issuerURL string, clientID string, httpClient *http.Client) *HTTPRefreshExchanger {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	return &HTTPRefreshExchanger{
		issuerURL:  strings.TrimRight(issuerURL, "/"),
		clientID:   clientID,
		httpClient: httpClient,
	}
}

func DefaultHTTPRefreshExchanger() *HTTPRefreshExchanger {
	return NewHTTPRefreshExchanger(defaultIssuerURL, defaultClientID, nil)
}

func (e *HTTPRefreshExchanger) Refresh(ctx context.Context, refreshToken string) (RefreshResult, error) {
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", refreshToken)
	form.Set("client_id", e.clientID)

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("%s/oauth/token", e.issuerURL),
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return RefreshResult{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	response, err := e.httpClient.Do(request)
	if err != nil {
		return RefreshResult{}, err
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return RefreshResult{}, fmt.Errorf("token refresh failed with status %d", response.StatusCode)
	}

	var payload struct {
		IDToken      string `json:"id_token"`
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return RefreshResult{}, err
	}

	return RefreshResult{
		IDToken:      optionalStringPointer(payload.IDToken),
		AccessToken:  payload.AccessToken,
		RefreshToken: optionalStringPointer(payload.RefreshToken),
	}, nil
}

func optionalStringPointer(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}

	return &value
}
