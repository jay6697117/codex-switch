package usage

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"
)

const (
	defaultBackendAPI = "https://chatgpt.com/backend-api"
	defaultUserAgent  = "codex-switch/0.1.0"
)

type HTTPFetcher struct {
	baseURL    string
	httpClient *http.Client
}

func NewHTTPFetcher(baseURL string, httpClient *http.Client) *HTTPFetcher {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	return &HTTPFetcher{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: httpClient,
	}
}

func DefaultHTTPFetcher() *HTTPFetcher {
	return NewHTTPFetcher(defaultBackendAPI, nil)
}

func (f *HTTPFetcher) FetchChatGPTUsage(
	ctx context.Context,
	request ChatGPTUsageRequest,
) (ProviderUsage, error) {
	httpRequest, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		fmt.Sprintf("%s/wham/usage", f.baseURL),
		nil,
	)
	if err != nil {
		return ProviderUsage{}, err
	}

	httpRequest.Header.Set("Authorization", fmt.Sprintf("Bearer %s", request.AccessToken))
	httpRequest.Header.Set("User-Agent", defaultUserAgent)
	if request.AccountID != nil && *request.AccountID != "" {
		httpRequest.Header.Set("chatgpt-account-id", *request.AccountID)
	}

	response, err := f.httpClient.Do(httpRequest)
	if err != nil {
		return ProviderUsage{}, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusUnauthorized {
		return ProviderUsage{}, ErrUnauthorized
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return ProviderUsage{}, fmt.Errorf("usage request failed with status %d", response.StatusCode)
	}

	var payload struct {
		PlanType  string `json:"plan_type"`
		RateLimit *struct {
			PrimaryWindow   *rawWindow `json:"primary_window"`
			SecondaryWindow *rawWindow `json:"secondary_window"`
		} `json:"rate_limit"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return ProviderUsage{}, err
	}

	return ProviderUsage{
		PlanType: payload.PlanType,
		FiveHour: normalizeRawWindow(payload.RateLimit, true),
		Weekly:   normalizeRawWindow(payload.RateLimit, false),
	}, nil
}

type rawWindow struct {
	UsedPercent        float64 `json:"used_percent"`
	LimitWindowSeconds *int    `json:"limit_window_seconds"`
	ResetAt            *int64  `json:"reset_at"`
}

func normalizeRawWindow(details *struct {
	PrimaryWindow   *rawWindow `json:"primary_window"`
	SecondaryWindow *rawWindow `json:"secondary_window"`
}, primary bool) *ProviderWindow {
	if details == nil {
		return nil
	}

	var window *rawWindow
	if primary {
		window = details.PrimaryWindow
	} else {
		window = details.SecondaryWindow
	}
	if window == nil {
		return nil
	}

	var resetsAt *time.Time
	if window.ResetAt != nil {
		value := time.Unix(*window.ResetAt, 0).UTC()
		resetsAt = &value
	}

	windowMinutes := 0
	if window.LimitWindowSeconds != nil {
		windowMinutes = int(math.Ceil(float64(*window.LimitWindowSeconds) / 60))
	}

	return &ProviderWindow{
		UsedPercent:   int(math.Round(window.UsedPercent)),
		WindowMinutes: windowMinutes,
		ResetsAt:      resetsAt,
	}
}
