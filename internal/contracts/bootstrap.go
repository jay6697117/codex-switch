package contracts

type LocaleCode string

const (
	LocaleZhCN LocaleCode = "zh-CN"
	LocaleEnUS LocaleCode = "en-US"
)

var SupportedLocales = []LocaleCode{LocaleZhCN, LocaleEnUS}

type AppInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type AppMessage struct {
	Code string            `json:"code"`
	Args map[string]string `json:"args,omitempty"`
}

type AppError struct {
	Code string            `json:"code"`
	Args map[string]string `json:"args,omitempty"`
}

func (e AppError) Error() string {
	return e.Code
}

type BootstrapPayload struct {
	Locale            LocaleCode   `json:"locale"`
	SupportedLocales  []LocaleCode `json:"supportedLocales"`
	HasManualOverride bool         `json:"hasManualOverride"`
	App               AppInfo      `json:"app"`
}

type EventEnvelope struct {
	Name    string      `json:"name"`
	Message *AppMessage `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

type ResultEnvelope[T any] struct {
	Data    T           `json:"data,omitempty"`
	Message *AppMessage `json:"message,omitempty"`
	Error   *AppError   `json:"error,omitempty"`
}
