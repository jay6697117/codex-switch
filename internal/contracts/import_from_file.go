package contracts

// ImportFromFileInput 从 auth.json 文件导入账户的输入参数
type ImportFromFileInput struct {
	AccountName string `json:"accountName"`
	FilePath    string `json:"filePath"`
}
