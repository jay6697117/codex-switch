package switching

import (
	"context"
	"strconv"
	"sync"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"
	platformprocess "codex-switch/internal/platform/process"
)

type Service struct {
	repository        accounts.Repository
	authStore         AuthFileStore
	processController platformprocess.Controller
	now               func() time.Time
	mu                sync.Mutex
}

func NewService(
	repository accounts.Repository,
	authStore AuthFileStore,
	processController platformprocess.Controller,
) *Service {
	return &Service{
		repository:        repository,
		authStore:         authStore,
		processController: processController,
		now:               time.Now().UTC,
	}
}

func (s *Service) GetProcessStatus(ctx context.Context) (contracts.ProcessStatus, error) {
	processes, err := s.processController.Detect(ctx)
	if err != nil {
		return contracts.ProcessStatus{}, contracts.AppError{Code: "process.detect_failed"}
	}

	return platformprocess.Summarize(processes), nil
}

func (s *Service) SwitchAccount(
	ctx context.Context,
	input contracts.SwitchAccountInput,
) (contracts.SwitchAccountResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	store, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.SwitchAccountResult{}, contracts.AppError{Code: "switch.active_update_failed"}
	}

	previousStore := accounts.CloneStore(store)
	targetAccount, ok := findAccountByID(store.Accounts, input.AccountID)
	if !ok {
		return contracts.SwitchAccountResult{}, contracts.AppError{Code: "switch.account_not_found"}
	}

	targetAuth, err := buildAuthFile(targetAccount, s.now())
	if err != nil {
		return contracts.SwitchAccountResult{}, err
	}

	processes, err := s.processController.Detect(ctx)
	if err != nil {
		return contracts.SwitchAccountResult{}, contracts.AppError{Code: "process.detect_failed"}
	}

	status := platformprocess.Summarize(processes)
	hasRunningProcesses := status.ForegroundCount > 0 || status.BackgroundCount > 0
	if hasRunningProcesses && !input.ConfirmRestart {
		return contracts.SwitchAccountResult{}, contracts.AppError{
			Code: "switch.confirmation_required",
			Args: map[string]string{
				"foregroundCount": intString(status.ForegroundCount),
				"backgroundCount": intString(status.BackgroundCount),
			},
		}
	}

	var previousAuth *AuthFile
	previousAuth, err = s.authStore.ReadCurrent(ctx)
	if err != nil {
		return contracts.SwitchAccountResult{}, contracts.AppError{Code: "switch.auth_write_failed"}
	}

	processesStopped := false
	if hasRunningProcesses {
		if err := s.processController.Stop(ctx, processes); err != nil {
			return contracts.SwitchAccountResult{}, contracts.AppError{Code: "process.stop_failed"}
		}
		processesStopped = true
	}

	authChanged := false
	if err := s.authStore.Write(ctx, *targetAuth); err != nil {
		if rollbackErr := s.rollback(ctx, previousStore, previousAuth, processes, processesStopped, authChanged); rollbackErr != nil {
			return contracts.SwitchAccountResult{}, rollbackErr
		}
		return contracts.SwitchAccountResult{}, contracts.AppError{Code: "switch.auth_write_failed"}
	}
	authChanged = true

	updatedStore := accounts.CloneStore(previousStore)
	activateAccount(&updatedStore, targetAccount.ID, s.now())

	if err := s.repository.Save(ctx, updatedStore); err != nil {
		if rollbackErr := s.rollback(ctx, previousStore, previousAuth, processes, processesStopped, authChanged); rollbackErr != nil {
			return contracts.SwitchAccountResult{}, rollbackErr
		}
		return contracts.SwitchAccountResult{}, contracts.AppError{Code: "switch.active_update_failed"}
	}

	restartPerformed := false
	if processesStopped {
		restartPerformed = true
		if err := s.processController.Restart(ctx, processes); err != nil {
			if rollbackErr := s.rollback(ctx, previousStore, previousAuth, processes, processesStopped, authChanged); rollbackErr != nil {
				return contracts.SwitchAccountResult{}, rollbackErr
			}
			return contracts.SwitchAccountResult{}, contracts.AppError{Code: "process.restart_failed"}
		}
	}

	return contracts.SwitchAccountResult{
		Accounts:         accounts.SnapshotFromStore(updatedStore),
		RestartPerformed: restartPerformed,
	}, nil
}

func (s *Service) rollback(
	ctx context.Context,
	previousStore accounts.AccountsStore,
	previousAuth *AuthFile,
	processes []platformprocess.Descriptor,
	processesStopped bool,
	authChanged bool,
) error {
	if authChanged {
		if err := s.authStore.Restore(ctx, previousAuth); err != nil {
			return contracts.AppError{Code: "switch.rollback_failed"}
		}
	}

	if err := s.repository.Save(ctx, accounts.CloneStore(previousStore)); err != nil {
		return contracts.AppError{Code: "switch.rollback_failed"}
	}

	if processesStopped {
		if err := s.processController.Restart(ctx, processes); err != nil {
			return contracts.AppError{Code: "switch.rollback_failed"}
		}
	}

	return nil
}

func buildAuthFile(account accounts.AccountRecord, now time.Time) (*AuthFile, error) {
	switch account.Auth.Kind {
	case "apiKey":
		if account.Auth.APIKey == nil || account.Auth.APIKey.APIKey == "" {
			return nil, contracts.AppError{Code: "switch.credentials_missing"}
		}
		apiKey := account.Auth.APIKey.APIKey
		return &AuthFile{
			OpenAIAPIKey: &apiKey,
		}, nil
	case "chatgpt":
		chatGPT := account.Auth.ChatGPT
		if chatGPT == nil || chatGPT.IDToken == "" || chatGPT.AccessToken == "" || chatGPT.RefreshToken == "" {
			return nil, contracts.AppError{Code: "switch.credentials_missing"}
		}
		lastRefresh := now
		return &AuthFile{
			Tokens: &TokenData{
				IDToken:      chatGPT.IDToken,
				AccessToken:  chatGPT.AccessToken,
				RefreshToken: chatGPT.RefreshToken,
				AccountID:    copyStringPointer(chatGPT.AccountID),
			},
			LastRefresh: &lastRefresh,
		}, nil
	default:
		return nil, contracts.AppError{Code: "switch.credentials_missing"}
	}
}

func findAccountByID(accountsList []accounts.AccountRecord, accountID string) (accounts.AccountRecord, bool) {
	for _, account := range accountsList {
		if account.ID == accountID {
			return account, true
		}
	}

	return accounts.AccountRecord{}, false
}

func activateAccount(store *accounts.AccountsStore, accountID string, now time.Time) {
	store.ActiveAccountID = stringPointer(accountID)

	for index := range store.Accounts {
		if store.Accounts[index].ID != accountID {
			continue
		}

		store.Accounts[index].LastUsedAt = timePointer(now)
		break
	}
}

func intString(value int) string {
	return strconv.Itoa(value)
}

func stringPointer(value string) *string {
	return &value
}

func timePointer(value time.Time) *time.Time {
	return &value
}

func copyStringPointer(value *string) *string {
	if value == nil {
		return nil
	}

	copyValue := *value
	return &copyValue
}
