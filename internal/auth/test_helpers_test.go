package auth

import (
	"encoding/base64"
	"fmt"
	"testing"
)

func fakeJWT(t *testing.T, payload string) string {
	t.Helper()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
	encodedPayload := base64.RawURLEncoding.EncodeToString([]byte(payload))

	return fmt.Sprintf("%s.%s.signature", header, encodedPayload)
}

func stringPointer(value string) *string {
	return &value
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
