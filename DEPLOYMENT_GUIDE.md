# Azure 部署指南 - Team Together Platform

## 快速開始（5分鐘部署）

### 前置需求
- Azure 帳號（已有）
- Azure CLI 已安裝
- 或使用 Azure Cloud Shell（無需安裝）

### 方法 1：使用 Azure Cloud Shell（推薦）

1. 登入 Azure Portal
2. 點擊右上角的 Cloud Shell 圖示
3. 複製並執行下方腳本

### 方法 2：本地 Azure CLI

```bash
# 1. 登入
az login

# 2. 設定變數
RG_NAME="team-together-rg"
LOCATION="southeastasia"
SQL_SERVER="team-together-sql"
SQL_DB="team_together_platform"
APP_NAME="team-together-api"
APP_PLAN="team-together-plan"

# 3. 建立資源群組
az group create \
  --name $RG_NAME \
  --location $LOCATION

# 4. 建立 SQL Server
az sql server create \
  --resource-group $RG_NAME \
  --name $SQL_SERVER \
  --admin-user adminuser \
  --admin-password "P@ssw0rd123!TeamTogether" \
  --location $LOCATION

# 5. 配置防火牆規則（允許 Azure 服務）
az sql server firewall-rule create \
  --resource-group $RG_NAME \
  --server $SQL_SERVER \
  --name "AllowAzure" \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# 6. 建立 SQL Database
az sql db create \
  --resource-group $RG_NAME \
  --server $SQL_SERVER \
  --name $SQL_DB \
  --edition Basic \
  --service-objective db_gen5_1

# 7. 建立 App Service 計畫
az appservice plan create \
  --name $APP_PLAN \
  --resource-group $RG_NAME \
  --sku B1 \
  --is-linux

# 8. 建立 App Service
az webapp create \
  --resource-group $RG_NAME \
  --plan $APP_PLAN \
  --name $APP_NAME \
  --runtime "node|18-lts"

# 9. 配置應用程式設定
az webapp config appsettings set \
  --resource-group $RG_NAME \
  --name $APP_NAME \
  --settings \
    AZURE_SQL_SERVER="${SQL_SERVER}.database.windows.net" \
    AZURE_SQL_DATABASE="$SQL_DB" \
    AZURE_SQL_USER="adminuser" \
    AZURE_SQL_PASSWORD="P@ssw0rd123!TeamTogether" \
    AZURE_SQL_PORT="1433" \
    PORT="8080" \
    NODE_ENV="production"

echo "✅ 基礎設施部署完成！"
echo "App Service URL: https://${APP_NAME}.azurewebsites.net"
```

## 部署應用程式代碼

### Step 1: 克隆倉庫
```bash
git clone https://github.com/Quanling-Quanyu/team-together-platform
cd team-together-platform
```

### Step 2: 安裝依賴
```bash
npm install
```

### Step 3: 建立 .env 文件
```bash
cp .env.example .env
# 編輯 .env 填入您的 API 密鑰
```

### Step 4: 部署到 Azure
```bash
# 使用 ZIP Deploy
zip -r deployment.zip . -x "node_modules/*" ".git/*"

az webapp deployment source config-zip \
  --resource-group team-together-rg \
  --name team-together-api \
  --src deployment.zip
```

## 驗證部署

```bash
# 檢查應用程式狀態
az webapp show \
  --resource-group team-together-rg \
  --name team-together-api \
  --query "state"

# 查看日誌
az webapp log tail \
  --resource-group team-together-rg \
  --name team-together-api
```

## 成本估計

- **App Service (B1)**: ¥300-400/月
- **SQL Database (Basic)**: ¥400-500/月
- **總計**: 約 ¥700-900/月（加上支付手續費）

## 下一步

1. ✅ 基礎設施部署完成
2. ⏳ 等待完整的 server.js 和數據庫初始化腳本
3. ⏳ 配置支付 API（Stripe, LINE Pay, ECPay, PayPal）
4. ⏳ LINE Bot 整合
5. ⏳ 測試和上線
