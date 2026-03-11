package locale

import (
	"context"
	"os"
)

type Detector struct{}

func NewDetector() Detector {
	return Detector{}
}

func (Detector) DetectLocale(context.Context) (string, error) {
	for _, key := range []string{
		"CODEX_SWITCH_SYSTEM_LOCALE",
		"LC_ALL",
		"LC_MESSAGES",
		"LANG",
	} {
		if value := os.Getenv(key); value != "" {
			return value, nil
		}
	}

	return "en-US", nil
}
