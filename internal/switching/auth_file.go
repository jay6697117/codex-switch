package switching

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type HomeResolver interface {
	ResolveCodexHome(ctx context.Context) (string, error)
}

type StaticHomeResolver struct {
	Path string
}

func (r StaticHomeResolver) ResolveCodexHome(context.Context) (string, error) {
	return r.Path, nil
}

type EnvHomeResolver struct{}

func (EnvHomeResolver) ResolveCodexHome(context.Context) (string, error) {
	if codexHome := strings.TrimSpace(os.Getenv("CODEX_HOME")); codexHome != "" {
		return codexHome, nil
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(homeDir, ".codex"), nil
}

type AuthFile struct {
	OpenAIAPIKey *string    `json:"OPENAI_API_KEY,omitempty"`
	Tokens       *TokenData `json:"tokens,omitempty"`
	LastRefresh  *time.Time `json:"last_refresh,omitempty"`
}

type TokenData struct {
	IDToken      string  `json:"id_token"`
	AccessToken  string  `json:"access_token"`
	RefreshToken string  `json:"refresh_token"`
	AccountID    *string `json:"account_id,omitempty"`
}

type AuthFileStore interface {
	ReadCurrent(ctx context.Context) (*AuthFile, error)
	Write(ctx context.Context, target AuthFile) error
	Restore(ctx context.Context, previous *AuthFile) error
}

type FileAuthStore struct {
	resolver HomeResolver
}

func NewFileAuthStore(resolver HomeResolver) *FileAuthStore {
	return &FileAuthStore{resolver: resolver}
}

func DefaultFileAuthStore() *FileAuthStore {
	return NewFileAuthStore(EnvHomeResolver{})
}

func (s *FileAuthStore) ReadCurrent(ctx context.Context) (*AuthFile, error) {
	authPath, err := s.resolveAuthPath(ctx)
	if err != nil {
		return nil, err
	}

	content, err := os.ReadFile(authPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var payload AuthFile
	if err := json.Unmarshal(content, &payload); err != nil {
		return nil, err
	}

	return &payload, nil
}

func (s *FileAuthStore) Write(ctx context.Context, target AuthFile) error {
	authPath, err := s.resolveAuthPath(ctx)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(authPath), 0o755); err != nil {
		return err
	}

	return writeAuthFile(authPath, target)
}

func (s *FileAuthStore) Restore(ctx context.Context, previous *AuthFile) error {
	authPath, err := s.resolveAuthPath(ctx)
	if err != nil {
		return err
	}

	if previous == nil {
		if err := os.Remove(authPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(authPath), 0o755); err != nil {
		return err
	}

	return writeAuthFile(authPath, *previous)
}

func (s *FileAuthStore) authPath() string {
	authPath, _ := s.resolveAuthPath(context.Background())
	return authPath
}

func (s *FileAuthStore) resolveAuthPath(ctx context.Context) (string, error) {
	codexHome, err := s.resolver.ResolveCodexHome(ctx)
	if err != nil {
		return "", err
	}

	return filepath.Join(codexHome, "auth.json"), nil
}

func writeAuthFile(path string, target AuthFile) error {
	content, err := json.MarshalIndent(target, "", "  ")
	if err != nil {
		return err
	}

	tempFile, err := os.CreateTemp(filepath.Dir(path), "auth-*.json")
	if err != nil {
		return err
	}

	tempPath := tempFile.Name()
	if _, err := tempFile.Write(content); err != nil {
		_ = tempFile.Close()
		_ = os.Remove(tempPath)
		return err
	}
	if err := tempFile.Close(); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	if err := os.Chmod(tempPath, 0o600); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	if err := os.Rename(tempPath, path); err != nil {
		_ = os.Remove(tempPath)
		return err
	}

	return nil
}
