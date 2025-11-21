# Team Together Platform

🙋 **Spiritual Wellness Marketplace** with affiliate system, subscription tiers, and multi-vendor support. Node.js backend, Azure cloud deployment.

## Overview

Team Together Platform is a comprehensive spiritual wellness marketplace built to scale. It combines:
- **Phase 1:** User management & 4-tier subscription system
- **Phase 2:** Affiliate tracking with multi-category commission rates
- **Phase 3:** Lottery pool system with tax handling
- **LINE Bot:** Daily push notifications, order/appointment reminders
- **Multi-Gateway Payments:** Stripe, LINE Pay, ECPay, PayPal

## Key Features

### 💳 Subscription Tiers (All in NTD)
- **迎接豐盛** (NT$333/month) - Image page + article templates
- **創造富足** (NT$666/month) - Products + order management
- **累積福報** (NT$666/month) - Services + video consultation
- **傳承幸福** (NT$999/month) - All above + course upload

### 💵 Affiliate System
- Commission rates: Products (8%), Services (15%), Courses (12%)
- 30-day cookie tracking with referral URLs
- Monthly bonuses and achievement multipliers
- Excel/PDF report export

### 🎉 Lottery Pool
- Triggered at configurable revenue thresholds
- Affiliate entries: 1 per ¥10,000 commission
- Consumer entries: 1 per 10 points (¥1=1 point)
- Tax withholding: 10% on prizes >¥20,000

### 📱 LINE Bot Features
- Daily fortune divination at 7am
- Bedtime reminder (9pm journal prompts)
- Order/appointment notifications
- Direct LINE booking → order creation with LINE Pay

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** Azure SQL Database (T-SQL)
- **Authentication:** JWT + bcrypt
- **Payments:** Stripe SDK, LINE Pay API, ECPay
- **Frontend:** HTML5 + CSS3 Grid + Vanilla JS
- **LINE Integration:** @line/bot-sdk
- **Reports:** Excel4Node, PDFKit

## Project Structure

```
team-together-platform/
├── server.js                 # Main Express server (630 lines)
├── database.sql              # Azure SQL schema (8 tables)
├── package.json              # Dependencies
├── .env.example              # Configuration template
├── DEPLOYMENT_GUIDE.md       # Azure deployment script
├── public/
│   └── index.html           # Dashboard UI
└── README.md                 # This file
```

## Installation & Deployment

### 1. Prerequisites
- Node.js 16+
- Azure account with SQL Database
- API keys: Stripe, LINE Pay, ECPay, PayPal (optional)

### 2. Local Setup
```bash
# Clone repository
git clone https://github.com/Quanling-Quanyu/team-together-platform
cd team-together-platform

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Fill in your Azure SQL credentials and API keys
```

### 3. Database Setup
```sql
-- Execute in Azure SQL Query Editor
-- Copy entire content of database.sql
sqlcmd -S <server>.database.windows.net -U <username> -P <password> -d <database> -i database.sql
```

### 4. Azure Deployment

Follow instructions in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - complete 5-minute setup:
```bash
# 1. Create Resource Group
az group create --name team-together-rg --location southeast asia

# 2. Deploy infrastructure
# See DEPLOYMENT_GUIDE.md for full script
```

### 5. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns JWT)
- `GET /api/users/:user_id` - Get user profile

### Subscriptions (Phase 1)
- `POST /api/subscriptions/purchase` - Purchase tier

### Affiliate (Phase 2)
- `POST /api/affiliates/referral-url` - Generate referral link
- `GET /api/affiliates/track` - Track referral click
- `POST /api/affiliates/record-sale` - Record sale + commission
- `GET /api/affiliates/report` - Get commission report
- `GET /api/affiliates/export/excel` - Export to Excel

### Lottery (Phase 3)
- `POST /api/lottery/check-threshold` - Check if drawing triggers
- `POST /api/lottery/draw` - Execute lottery
- `GET /api/lottery/winners` - Get winners list

### Payments
- `POST /api/payments/line-pay` - LINE Pay initiation
- `POST /api/payments/ecpay` - ECPay initiation
- `POST /api/webhooks/stripe` - Stripe webhook handler

### LINE Bot
- `POST /api/line-bot/webhook` - LINE message handler
- `POST /api/line-bot/push-fortune` - Send fortune divination
- `POST /api/line-bot/push-reminder` - Send bedtime reminder
- `POST /api/line-bot/order-notification` - Order confirmation
- `POST /api/line-bot/direct-booking` - LINE booking → order

## Configuration (.env)

```env
# Database
DB_SERVER=your-sql-server.database.windows.net
DB_USER=your-admin
DB_PASSWORD=your-password
DB_NAME=team_together_platform

# JWT
JWT_SECRET=your-secret-key-min-32-chars

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# LINE
LINE_CHANNEL_ACCESS_TOKEN=your-token
LINE_CHANNEL_SECRET=your-secret
LINE_PAY_CHANNEL_ID=...
LINE_PAY_CHANNEL_SECRET=...

# ECPay
ECPAY_MERCHANT_ID=3390993

# App
PORT=3000
NODE_ENV=development
```

## Database Schema

### 8 Core Tables
1. **users** - User accounts + subscription tier
2. **subscriptions** - Subscription records + expiry
3. **affiliates** - Referral codes + commission tracking
4. **sales** - Transaction records with affiliate attribution
5. **referral_sessions** - 30-day referral cookies
6. **lottery_drawings** - Drawing history
7. **lottery_winners** - Prize winners + tax withheld
8. **bookings** - Service/consultation appointments

## Monthly Cost Breakdown (NT$)

- **Azure App Service (B1):** NT$300-400
- **Azure SQL Database (Basic):** NT$400-500
- **LINE Bot webhook:** Free
- **Stripe/Payments:** % per transaction
- **Total:** <NT$2000/month

## Development Timeline

- **Phase 1:** User auth + subscriptions ✅
- **Phase 2:** Affiliate system + commissions ✅
- **Phase 3:** Lottery + tax calculation ✅
- **Phase 4:** Services + bookings (Next)
- **Phase 5:** Products + inventory (Next)
- **Phase 6:** Courses + curriculum (Next)

## Support & Maintenance

- **Documentation:** See comments in server.js for endpoint details
- **Issues:** GitHub Issues
- **Security:** Report security issues privately

## License

Copyright © 2025 Team Together. All rights reserved.

---

**Built with ❤️ for spiritual wellness entrepreneurs**

*Last updated: Nov 21, 2025*
