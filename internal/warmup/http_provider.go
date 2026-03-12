package warmup

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"codex-switch/internal/buildinfo"
)

const (
	defaultChatGPTBaseURL = "https://chatgpt.com/backend-api"
	defaultOpenAIBaseURL  = "https://api.openai.com/v1"
)

type HTTPProvider struct {
	chatGPTBaseURL string
	openAIBaseURL  string
	httpClient     *http.Client
}

func NewHTTPProvider(
	chatGPTBaseURL string,
	openAIBaseURL string,
	httpClient *http.Client,
) *HTTPProvider {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	return &HTTPProvider{
		chatGPTBaseURL: strings.TrimRight(chatGPTBaseURL, "/"),
		openAIBaseURL:  strings.TrimRight(openAIBaseURL, "/"),
		httpClient:     httpClient,
	}
}

func DefaultHTTPProvider() *HTTPProvider {
	return NewHTTPProvider(defaultChatGPTBaseURL, defaultOpenAIBaseURL, nil)
}

func (p *HTTPProvider) WarmChatGPT(ctx context.Context, request ChatGPTWarmupRequest) error {
	httpRequest, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		fmt.Sprintf("%s/wham/usage", p.chatGPTBaseURL),
		nil,
	)
	if err != nil {
		return err
	}

	httpRequest.Header.Set("Authorization", fmt.Sprintf("Bearer %s", request.AccessToken))
	httpRequest.Header.Set("User-Agent", buildinfo.UserAgent())
	if request.AccountID != nil && *request.AccountID != "" {
		httpRequest.Header.Set("chatgpt-account-id", *request.AccountID)
	}

	response, err := p.httpClient.Do(httpRequest)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	return normalizeHTTPResponse(response.StatusCode)
}

func (p *HTTPProvider) WarmAPIKey(ctx context.Context, request APIKeyWarmupRequest) error {
	httpRequest, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		fmt.Sprintf("%s/models", p.openAIBaseURL),
		nil,
	)
	if err != nil {
		return err
	}

	httpRequest.Header.Set("Authorization", fmt.Sprintf("Bearer %s", request.APIKey))
	httpRequest.Header.Set("User-Agent", buildinfo.UserAgent())

	response, err := p.httpClient.Do(httpRequest)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	return normalizeHTTPResponse(response.StatusCode)
}

func normalizeHTTPResponse(statusCode int) error {
	if statusCode == http.StatusUnauthorized {
		return ErrUnauthorized
	}

	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("warmup request failed with status %d", statusCode)
	}

	return nil
}
