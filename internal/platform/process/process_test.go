package process

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseUnixPSOutputSeparatesForegroundAndBackgroundCodex(t *testing.T) {
	t.Parallel()

	output := `
  101 /usr/local/bin/codex
  202 /usr/local/bin/codex --mode agent .antigravity
  303 /Applications/Codex Switcher.app/Contents/MacOS/codex-switcher
  404 /usr/bin/python helper.py
`

	processes := parseUnixPSOutput(output, 999)
	status := summarize(processes)

	require.Len(t, processes, 2)
	require.Equal(t, 1, status.ForegroundCount)
	require.Equal(t, 1, status.BackgroundCount)
	require.False(t, status.CanSwitch)
}

func TestSummarizeReturnsSwitchableWhenNoProcesses(t *testing.T) {
	t.Parallel()

	status := summarize(nil)

	require.Zero(t, status.ForegroundCount)
	require.Zero(t, status.BackgroundCount)
	require.True(t, status.CanSwitch)
}
