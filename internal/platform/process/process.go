package process

import (
	"context"
	"encoding/csv"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"codex-switch/internal/contracts"
)

type Descriptor struct {
	PID          uint32
	Command      string
	IsBackground bool
}

type Controller interface {
	Detect(ctx context.Context) ([]Descriptor, error)
	Stop(ctx context.Context, processes []Descriptor) error
	Restart(ctx context.Context, processes []Descriptor) error
}

type OSController struct {
	selfPID uint32
}

func NewOSController() *OSController {
	return &OSController{
		selfPID: uint32(runtimeProcessID()),
	}
}

func (c *OSController) Detect(ctx context.Context) ([]Descriptor, error) {
	switch runtime.GOOS {
	case "windows":
		output, err := commandOutput(ctx, "tasklist", "/FI", "IMAGENAME eq codex.exe", "/FO", "CSV", "/NH")
		if err != nil {
			return nil, err
		}
		return parseWindowsTaskList(output, c.selfPID), nil
	default:
		output, err := commandOutput(ctx, "ps", "-eo", "pid=,command=")
		if err != nil {
			return nil, err
		}
		return parseUnixPSOutput(output, c.selfPID), nil
	}
}

func (c *OSController) Stop(ctx context.Context, processes []Descriptor) error {
	if len(processes) == 0 {
		return nil
	}

	switch runtime.GOOS {
	case "windows":
		for _, process := range processes {
			if err := commandRun(ctx, "taskkill", "/PID", fmt.Sprintf("%d", process.PID)); err != nil {
				return err
			}
		}
		time.Sleep(2 * time.Second)
		return nil
	default:
		for _, process := range processes {
			_ = commandRun(ctx, "kill", "-TERM", fmt.Sprintf("%d", process.PID))
		}

		deadline := time.Now().Add(5 * time.Second)
		for time.Now().Before(deadline) {
			anyRunning := false
			for _, process := range processes {
				if err := commandRun(ctx, "kill", "-0", fmt.Sprintf("%d", process.PID)); err == nil {
					anyRunning = true
					break
				}
			}
			if !anyRunning {
				return nil
			}
			time.Sleep(100 * time.Millisecond)
		}

		return fmt.Errorf("timed out waiting for Codex processes to stop")
	}
}

func (c *OSController) Restart(ctx context.Context, processes []Descriptor) error {
	switch runtime.GOOS {
	case "windows":
		for _, process := range processes {
			command := strings.TrimSpace(process.Command)
			if command == "" {
				command = "codex"
			}

			cmd := exec.CommandContext(ctx, "cmd", "/C", "start", "", "/B", command)
			if err := startDetached(cmd); err != nil {
				return err
			}
		}
		return nil
	default:
		for _, process := range processes {
			command := strings.TrimSpace(process.Command)
			if command == "" {
				continue
			}

			cmd := exec.CommandContext(
				ctx,
				"sh",
				"-c",
				"nohup sh -lc \"$1\" >/dev/null 2>&1 &",
				"sh",
				command,
			)
			if err := startDetached(cmd); err != nil {
				return err
			}
		}
		return nil
	}
}

func Summarize(processes []Descriptor) contracts.ProcessStatus {
	return summarize(processes)
}

func summarize(processes []Descriptor) contracts.ProcessStatus {
	status := contracts.ProcessStatus{
		CanSwitch: true,
	}

	for _, process := range processes {
		if process.IsBackground {
			status.BackgroundCount++
		} else {
			status.ForegroundCount++
		}
	}

	status.CanSwitch = status.ForegroundCount == 0 && status.BackgroundCount == 0
	return status
}

func parseUnixPSOutput(output string, selfPID uint32) []Descriptor {
	processes := make([]Descriptor, 0)

	for _, rawLine := range strings.Split(output, "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}

		pidCommand := strings.Fields(line)
		if len(pidCommand) < 2 {
			continue
		}

		pid, err := parseUint32(pidCommand[0])
		if err != nil || pid == selfPID {
			continue
		}

		command := strings.TrimSpace(strings.TrimPrefix(line, pidCommand[0]))
		executable := strings.Fields(command)
		if len(executable) == 0 {
			continue
		}

		binary := executable[0]
		isCodex := binary == "codex" || strings.HasSuffix(binary, "/codex")
		isSwitcher := strings.Contains(command, "codex-switcher") || strings.Contains(command, "Codex Switcher")
		if !isCodex || isSwitcher {
			continue
		}

		processes = append(processes, Descriptor{
			PID:          pid,
			Command:      command,
			IsBackground: isBackgroundCommand(command),
		})
	}

	return processes
}

func parseWindowsTaskList(output string, selfPID uint32) []Descriptor {
	reader := csv.NewReader(strings.NewReader(output))
	records, err := reader.ReadAll()
	if err != nil {
		return nil
	}

	processes := make([]Descriptor, 0, len(records))
	for _, record := range records {
		if len(record) < 2 {
			continue
		}

		if strings.ToLower(strings.TrimSpace(record[0])) != "codex.exe" {
			continue
		}

		pid, err := parseUint32(strings.TrimSpace(record[1]))
		if err != nil || pid == selfPID {
			continue
		}

		processes = append(processes, Descriptor{
			PID:          pid,
			Command:      "codex",
			IsBackground: false,
		})
	}

	return processes
}

func isBackgroundCommand(command string) bool {
	return strings.Contains(command, ".antigravity") ||
		strings.Contains(command, "openai.chatgpt") ||
		strings.Contains(command, ".vscode")
}

func commandOutput(ctx context.Context, name string, args ...string) (string, error) {
	output, err := exec.CommandContext(ctx, name, args...).Output()
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func commandRun(ctx context.Context, name string, args ...string) error {
	return exec.CommandContext(ctx, name, args...).Run()
}

func startDetached(cmd *exec.Cmd) error {
	cmd.Stdin = nil
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Start()
}

func parseUint32(raw string) (uint32, error) {
	var value uint32
	_, err := fmt.Sscanf(strings.TrimSpace(raw), "%d", &value)
	return value, err
}

func runtimeProcessID() int {
	return os.Getpid()
}
