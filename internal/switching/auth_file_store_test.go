package switching

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFileAuthStoreWritesAndReadsAuthJSONUnderCodexHome(t *testing.T) {
	t.Parallel()

	codexHome := t.TempDir()
	store := NewFileAuthStore(StaticHomeResolver{Path: codexHome})

	payload := AuthFile{
		Tokens: &TokenData{
			IDToken:      "id-token",
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
			AccountID:    stringPointer("acct-123"),
		},
	}

	require.NoError(t, store.Write(context.Background(), payload))

	loaded, err := store.ReadCurrent(context.Background())

	require.NoError(t, err)
	require.NotNil(t, loaded)
	require.Equal(t, filepath.Join(codexHome, "auth.json"), store.authPath())
	require.Equal(t, "id-token", loaded.Tokens.IDToken)
	require.Equal(t, "acct-123", dereference(loaded.Tokens.AccountID))
}
