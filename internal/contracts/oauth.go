package contracts

type StartOAuthLoginInput struct {
	AccountName string `json:"accountName"`
}

type OAuthLoginInfo struct {
	AuthURL      string `json:"authUrl"`
	CallbackPort int    `json:"callbackPort"`
	Pending      bool   `json:"pending"`
}

type OAuthCancelResult struct {
	Pending bool `json:"pending"`
}
