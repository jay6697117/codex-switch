package locale

import (
	"strings"

	"codex-switch/internal/contracts"
)

func ResolveSupportedLocale(raw string) contracts.LocaleCode {
	normalized := strings.TrimSpace(strings.ToLower(raw))
	normalized = strings.ReplaceAll(normalized, "_", "-")

	if idx := strings.Index(normalized, "."); idx >= 0 {
		normalized = normalized[:idx]
	}

	switch {
	case strings.HasPrefix(normalized, "zh"):
		return contracts.LocaleZhCN
	case strings.HasPrefix(normalized, "en"):
		return contracts.LocaleEnUS
	default:
		return contracts.LocaleEnUS
	}
}
