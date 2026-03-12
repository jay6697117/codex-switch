package main

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestWailsConfigDefinesReleaseMetadataDefaults(t *testing.T) {
	t.Parallel()

	var config struct {
		Info struct {
			CompanyName    string `json:"companyName"`
			ProductName    string `json:"productName"`
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}

	content, err := os.ReadFile("wails.json")
	if err != nil {
		t.Fatalf("read wails.json: %v", err)
	}

	if err := json.Unmarshal(content, &config); err != nil {
		t.Fatalf("parse wails.json: %v", err)
	}

	if config.Info.CompanyName != "SteveZhang" {
		t.Fatalf("expected companyName SteveZhang, got %q", config.Info.CompanyName)
	}
	if config.Info.ProductName != "Codex Switch" {
		t.Fatalf("expected productName Codex Switch, got %q", config.Info.ProductName)
	}
	if config.Info.ProductVersion != "0.1.0-dev" {
		t.Fatalf("expected productVersion 0.1.0-dev, got %q", config.Info.ProductVersion)
	}
}

func TestDarwinPlistsUseReleaseBundleIdentifier(t *testing.T) {
	t.Parallel()

	paths := []string{
		"build/darwin/Info.plist",
		"build/darwin/Info.dev.plist",
	}

	for _, path := range paths {
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}

		text := string(content)
		if !strings.Contains(text, "com.stevezhang.codexswitch") {
			t.Fatalf("expected %s to use release bundle identifier", path)
		}
	}
}

func TestMacOSReleaseWorkflowAndDocsExist(t *testing.T) {
	t.Parallel()

	workflowContent, err := os.ReadFile(".github/workflows/macos-release.yml")
	if err != nil {
		t.Fatalf("read release workflow: %v", err)
	}

	workflow := string(workflowContent)
	requiredWorkflowStrings := []string{
		"workflow_dispatch:",
		"tags:",
		"v*",
		"APPLE_CERTIFICATE_P12_BASE64",
		"APPLE_CERTIFICATE_PASSWORD",
		"APPLE_SIGNING_IDENTITY",
		"APPLE_TEAM_ID",
		"APPLE_NOTARY_KEY_ID",
		"APPLE_NOTARY_ISSUER_ID",
		"APPLE_NOTARY_PRIVATE_KEY",
		"notarytool submit",
		"gh release",
		"checksums.txt",
	}

	for _, fragment := range requiredWorkflowStrings {
		if !strings.Contains(workflow, fragment) {
			t.Fatalf("expected release workflow to contain %q", fragment)
		}
	}

	requiredDocs := []string{
		"docs/release/macos-release.md",
		"docs/release/macos-packaged-smoke.md",
	}

	for _, path := range requiredDocs {
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("expected %s to exist: %v", path, err)
		}
	}
}
