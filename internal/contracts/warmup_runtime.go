package contracts

const WarmupRuntimeEventName = "warmup:scheduledResult"

const (
	WarmupRuntimeTriggerScheduled    = "scheduled"
	WarmupRuntimeTriggerMissedPrompt = "missed_prompt"
)

type WarmupRuntimeEvent struct {
	Trigger     string          `json:"trigger"`
	CompletedAt string          `json:"completedAt"`
	Result      WarmupAllResult `json:"result"`
}
