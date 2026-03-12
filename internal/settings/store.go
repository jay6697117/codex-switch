package settings

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"codex-switch/internal/contracts"
)

type Store struct {
	path string
	mu   *sync.Mutex
}

type preferences struct {
	Locale             string                    `json:"locale,omitempty"`
	BackupSecurityMode string                    `json:"backupSecurityMode,omitempty"`
	WarmupSchedule     *contracts.WarmupSchedule `json:"warmupSchedule,omitempty"`
}

func NewStore(path string) Store {
	return Store{
		path: path,
		mu:   &sync.Mutex{},
	}
}

func DefaultStore() Store {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return Store{}
	}

	return Store{
		path: filepath.Join(configDir, "codex-switch", "preferences.json"),
		mu:   &sync.Mutex{},
	}
}

func (s Store) LoadLocalePreference(context.Context) (string, bool, error) {
	if strings.TrimSpace(s.path) == "" {
		return "", false, nil
	}

	s.lock()
	defer s.unlock()

	prefs, err := s.loadPreferencesLocked()
	if err != nil {
		return "", false, err
	}

	if strings.TrimSpace(prefs.Locale) == "" {
		return "", false, nil
	}

	return prefs.Locale, true, nil
}

func (s Store) LoadPreferences(context.Context) (preferences, error) {
	s.lock()
	defer s.unlock()

	return s.loadPreferencesLocked()
}

func (s Store) UpdatePreferences(_ context.Context, mutate func(*preferences) error) (preferences, error) {
	s.lock()
	defer s.unlock()

	prefs, err := s.loadPreferencesLocked()
	if err != nil {
		return preferences{}, err
	}

	if err := mutate(&prefs); err != nil {
		return preferences{}, err
	}

	if err := s.savePreferencesLocked(prefs); err != nil {
		return preferences{}, err
	}

	return prefs, nil
}

func (s Store) loadPreferencesLocked() (preferences, error) {
	if strings.TrimSpace(s.path) == "" {
		return preferences{}, nil
	}

	content, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return preferences{}, nil
	}
	if err != nil {
		return preferences{}, err
	}

	var prefs preferences
	if err := json.Unmarshal(content, &prefs); err != nil {
		return preferences{}, err
	}

	return prefs, nil
}

func (s Store) savePreferencesLocked(prefs preferences) error {
	if strings.TrimSpace(s.path) == "" {
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}

	content, err := json.MarshalIndent(prefs, "", "  ")
	if err != nil {
		return err
	}

	tempFile, err := os.CreateTemp(filepath.Dir(s.path), "preferences-*.json")
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
	if err := os.Rename(tempPath, s.path); err != nil {
		_ = os.Remove(tempPath)
		return err
	}

	return nil
}

func (s Store) lock() {
	if s.mu != nil {
		s.mu.Lock()
	}
}

func (s Store) unlock() {
	if s.mu != nil {
		s.mu.Unlock()
	}
}
