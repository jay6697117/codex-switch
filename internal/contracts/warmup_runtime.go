package contracts

const WarmupRuntimeEventName = "warmup:scheduledResult"

const (
	WarmupRuntimeTriggerScheduled    = "scheduled"
	WarmupRuntimeTriggerMissedPrompt = "missed_prompt"
)

type WarmupRuntimeEvent struct {
	Summary WarmupSummary `json:"summary"`
	Trigger string        `json:"trigger"`
}
