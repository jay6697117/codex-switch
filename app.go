package main

import (
	"context"

	"codex-switch/internal/bootstrap"
	"codex-switch/internal/contracts"
	platformlocale "codex-switch/internal/platform/locale"
	"codex-switch/internal/settings"
)

type App struct {
	ctx              context.Context
	bootstrapService *bootstrap.Service
}

func NewApp() *App {
	return &App{
		bootstrapService: bootstrap.NewService(
			settings.DefaultStore(),
			platformlocale.NewDetector(),
		),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) LoadBootstrap() (contracts.BootstrapPayload, error) {
	if a.ctx == nil {
		return a.bootstrapService.Load(context.Background())
	}

	return a.bootstrapService.Load(a.ctx)
}
