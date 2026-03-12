package buildinfo

const (
	AppName        = "Codex Switch"
	BundleID       = "com.stevezhang.codexswitch"
	DefaultVersion = "0.1.0-dev"
)

var Version = DefaultVersion

func UserAgent() string {
	return "codex-switch/" + Version
}
