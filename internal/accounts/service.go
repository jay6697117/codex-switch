package accounts

import (
	"context"
	"strings"
	"sync"
	"time"

	"codex-switch/internal/contracts"
)

type Service struct {
	repository Repository
	mu         sync.Mutex
	now        func() time.Time
}

func NewService(repository Repository) *Service {
	return &Service{
		repository: repository,
		now:        time.Now().UTC,
	}
}

func (s *Service) LoadAccounts(ctx context.Context) (contracts.AccountsSnapshot, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.AccountsSnapshot{}, err
	}

	return SnapshotFromStore(store), nil
}

func (s *Service) RenameAccount(ctx context.Context, id string, displayName string) (contracts.AccountsSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	store, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.AccountsSnapshot{}, err
	}

	normalizedName := strings.TrimSpace(displayName)
	if normalizedName == "" {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "account.name_required"}
	}

	accountIndex := -1
	for index, account := range store.Accounts {
		if account.ID == id {
			accountIndex = index
			continue
		}

		if account.DisplayName == normalizedName {
			return contracts.AccountsSnapshot{}, contracts.AppError{Code: "account.name_conflict"}
		}
	}

	if accountIndex < 0 {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "account.not_found"}
	}

	store.Accounts[accountIndex].DisplayName = normalizedName
	store.Accounts[accountIndex].UpdatedAt = s.now()

	if err := s.repository.Save(ctx, store); err != nil {
		return contracts.AccountsSnapshot{}, err
	}

	return SnapshotFromStore(store), nil
}

func (s *Service) DeleteAccount(ctx context.Context, id string) (contracts.AccountsSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	store, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.AccountsSnapshot{}, err
	}

	accountIndex := -1
	for index, account := range store.Accounts {
		if account.ID == id {
			accountIndex = index
			break
		}
	}

	if accountIndex < 0 {
		return contracts.AccountsSnapshot{}, contracts.AppError{Code: "account.not_found"}
	}

	wasActive := store.ActiveAccountID != nil && *store.ActiveAccountID == id
	store.Accounts = append(store.Accounts[:accountIndex], store.Accounts[accountIndex+1:]...)

	if len(store.Accounts) == 0 {
		store.ActiveAccountID = nil
	} else if wasActive {
		nextIndex := accountIndex
		if nextIndex >= len(store.Accounts) {
			nextIndex = 0
		}

		nextID := store.Accounts[nextIndex].ID
		store.ActiveAccountID = &nextID
	}

	if err := s.repository.Save(ctx, store); err != nil {
		return contracts.AccountsSnapshot{}, err
	}

	return SnapshotFromStore(store), nil
}
