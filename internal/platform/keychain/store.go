package keychain

import (
	"context"
	"crypto/rand"
	"encoding/base64"

	goKeyring "github.com/zalando/go-keyring"
)

const (
	defaultService = "codex-switch"
	defaultUser    = "backup-secret"
)

type Store struct {
	service  string
	user     string
	generate func() (string, error)
}

func NewStore(service string, user string) *Store {
	return &Store{
		service:  service,
		user:     user,
		generate: generateSecret,
	}
}

func NewDefaultStore() *Store {
	return NewStore(defaultService, defaultUser)
}

func (s *Store) Get(context.Context) (string, error) {
	return goKeyring.Get(s.service, s.user)
}

func (s *Store) GetOrCreate(ctx context.Context) (string, error) {
	secret, err := s.Get(ctx)
	if err == nil && secret != "" {
		return secret, nil
	}
	if err != nil && err != goKeyring.ErrNotFound {
		return "", err
	}

	secret, err = s.generate()
	if err != nil {
		return "", err
	}
	if err := goKeyring.Set(s.service, s.user, secret); err != nil {
		return "", err
	}

	return secret, nil
}

func generateSecret() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
