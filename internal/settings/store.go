package settings

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

type Store struct {
	path string
}

type preferences struct {
	Locale string `json:"locale,omitempty"`
}

func NewStore(path string) Store {
	return Store{path: path}
}

func DefaultStore() Store {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return Store{}
	}

	return Store{
		path: filepath.Join(configDir, "codex-switch", "preferences.json"),
	}
}

func (s Store) LoadLocalePreference(context.Context) (string, bool, error) {
	if strings.TrimSpace(s.path) == "" {
		return "", false, nil
	}

	content, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}

	var prefs preferences
	if err := json.Unmarshal(content, &prefs); err != nil {
		return "", false, err
	}

	if strings.TrimSpace(prefs.Locale) == "" {
		return "", false, nil
	}

	return prefs.Locale, true, nil
}
