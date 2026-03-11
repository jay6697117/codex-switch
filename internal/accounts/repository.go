package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

type Repository interface {
	Load(context.Context) (AccountsStore, error)
	Save(context.Context, AccountsStore) error
}

type FileRepository struct {
	path string
	mu   sync.Mutex
}

func NewFileRepository(path string) *FileRepository {
	return &FileRepository{path: path}
}

func DefaultFileRepository() *FileRepository {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return &FileRepository{}
	}

	return &FileRepository{
		path: filepath.Join(configDir, "codex-switch", "accounts.json"),
	}
}

func (r *FileRepository) Load(context.Context) (AccountsStore, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.load()
}

func (r *FileRepository) Save(_ context.Context, store AccountsStore) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.save(store)
}

func (r *FileRepository) load() (AccountsStore, error) {
	if r.path == "" {
		return defaultStore(), nil
	}

	content, err := os.ReadFile(r.path)
	if errors.Is(err, os.ErrNotExist) {
		return defaultStore(), nil
	}
	if err != nil {
		return AccountsStore{}, err
	}

	var store AccountsStore
	if err := json.Unmarshal(content, &store); err != nil {
		return AccountsStore{}, err
	}

	if store.Version == 0 {
		store.Version = storeVersion
	}
	if store.Accounts == nil {
		store.Accounts = []AccountRecord{}
	}

	return store, nil
}

func (r *FileRepository) save(store AccountsStore) error {
	if r.path == "" {
		return nil
	}

	if store.Version == 0 {
		store.Version = storeVersion
	}
	if store.Accounts == nil {
		store.Accounts = []AccountRecord{}
	}

	if err := os.MkdirAll(filepath.Dir(r.path), 0o755); err != nil {
		return err
	}

	content, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}

	tempFile, err := os.CreateTemp(filepath.Dir(r.path), "accounts-*.json")
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
	if err := os.Rename(tempPath, r.path); err != nil {
		_ = os.Remove(tempPath)
		return err
	}

	return nil
}
