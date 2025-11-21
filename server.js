// Team Together Platform - Main Server
// Complete backend implementation for Phase 1-3

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mssql = require('mssql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Stripe = require('stripe');
const line = require('@line/bot-sdk');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const excel = require('excel4node');
const PDFDocument = require('pdfkit');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ==================== DATABASE CONFIG ====================
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  pool: { min: 2, max: 10 },
  options: { encrypt: true, trustServerCertificate: false }
};

let connectionPool;
mssql.connect(config).then(pool => {
  connectionPool = pool;
  console.log('Azure SQL Database connected');
}).catch(err => console.error('Database connection failed:', err));

// ==================== MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ==================== PHASE 1: USER & SUBSCRIPTION ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const now = new Date();
    
    const request = connectionPool.request();
    await request
      .input('user_id', mssql.VarChar, userId)
      .input('email', mssql.VarChar, email)
      .input('password_hash', mssql.VarChar, hashedPassword)
      .input('name', mssql.VarChar, name)
      .input('created_at', mssql.DateTime, now)
      .query(`INSERT INTO users (user_id, email, password_hash, name, created_at) 
        VALUES (@user_id, @email, @password_hash, @name, @created_at)`);
    
    res.status(201).json({ success: true, user_id: userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const request = connectionPool.request();
    const result = await request
      .input('email', mssql.VarChar, email)
      .query('SELECT * FROM users WHERE email = @email');
    
    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.recordset[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({ token, user_id: user.user_id, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get User Profile
app.get('/api/users/:user_id', authenticateToken, async (req, res) => {
  try {
    const request = connectionPool.request();
    const result = await request
      .input('user_id', mssql.VarChar, req.params.user_id)
      .query('SELECT user_id, email, name, subscription_tier, created_at FROM users WHERE user_id = @user_id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Purchase Subscription
app.post('/api/subscriptions/purchase', authenticateToken, async (req, res) => {
  try {
    const { tier, payment_method, stripe_token } = req.body;
    
    const tierPrices = { '333': 33300, '666': 66600, '999': 99900 };
    const amount = tierPrices[tier];
    
    if (!amount) return res.status(400).json({ error: 'Invalid tier' });
    
    // Process Stripe payment
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const charge = await stripe.charges.create({
      amount: amount,
      currency: 'twd',
      source: stripe_token,
      description: `Team Together Platform - Tier ${tier} subscription`
    });
    
    // Update user subscription
    const request = connectionPool.request();
    const subscriptionId = uuidv4();
    const now = new Date();
    const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    await request
      .input('subscription_id', mssql.VarChar, subscriptionId)
      .input('user_id', mssql.VarChar, req.user.user_id)
      .input('tier', mssql.VarChar, tier)
      .input('start_date', mssql.DateTime, now)
      .input('expiry_date', mssql.DateTime, expiryDate)
      .input('status', mssql.VarChar, 'active')
      .query(`INSERT INTO subscriptions (subscription_id, user_id, tier, start_date, expiry_date, status) 
        VALUES (@subscription_id, @user_id, @tier, @start_date, @expiry_date, @status)`);
    
    await request
      .input('user_id2', mssql.VarChar, req.user.user_id)
      .input('tier2', mssql.VarChar, tier)
      .query('UPDATE users SET subscription_tier = @tier2 WHERE user_id = @user_id2');
    
    res.json({ success: true, subscription_id: subscriptionId, charge_id: charge.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PHASE 2: AFFILIATE SYSTEM ====================

// Generate Referral URL
app.post('/api/affiliates/referral-url', authenticateToken, async (req, res) => {
  try {
    const referralCode = `ref=${req.user.user_id.substring(0, 8)}_${Date.now()}`;
    const request = connectionPool.request();
    
    await request
      .input('affiliate_id', mssql.VarChar, uuidv4())
      .input('user_id', mssql.VarChar, req.user.user_id)
      .input('referral_code', mssql.VarChar, referralCode)
      .input('created_at', mssql.DateTime, new Date())
      .query(`INSERT INTO affiliates (affiliate_id, user_id, referral_code, commission_rate, created_at) 
        VALUES (@affiliate_id, @user_id, @referral_code, 0.08, @created_at)`);
    
    res.json({ referral_url: `https://www.teamtogetherstore.com?${referralCode}`, code: referralCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Track Referral Click
app.get('/api/affiliates/track', async (req, res) => {
  try {
    const referralCode = req.query.ref;
    if (!referralCode) return res.status(400).json({ error: 'No referral code' });
    
    const sessionId = uuidv4();
    const cookieExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const request = connectionPool.request();
    await request
      .input('session_id', mssql.VarChar, sessionId)
      .input('referral_code', mssql.VarChar, referralCode)
      .input('created_at', mssql.DateTime, new Date())
      .input('expires_at', mssql.DateTime, cookieExpiry)
      .query(`INSERT INTO referral_sessions (session_id, referral_code, created_at, expires_at) 
        VALUES (@session_id, @referral_code, @created_at, @expires_at)`);
    
    res.cookie('referral_session', sessionId, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Record Sale with Affiliate Commission
app.post('/api/affiliates/record-sale', async (req, res) => {
  try {
    const { user_id, amount, product_category, referral_code } = req.body;
    const saleId = uuidv4();
    
    // Get commission rate by category
    const commissionRates = {
      'products': 0.08,
      'services': 0.15,
      'courses': 0.12
    };
    
    const commissionRate = commissionRates[product_category] || 0.08;
    const commissionAmount = amount * commissionRate;
    
    const request = connectionPool.request();
    
    // Record sale
    await request
      .input('sale_id', mssql.VarChar, saleId)
      .input('user_id', mssql.VarChar, user_id)
      .input('amount', mssql.Numeric(15,2), amount)
      .input('category', mssql.VarChar, product_category)
      .input('commission_amount', mssql.Numeric(15,2), commissionAmount)
      .input('referral_code', mssql.VarChar, referral_code)
      .input('created_at', mssql.DateTime, new Date())
      .query(`INSERT INTO sales (sale_id, user_id, amount, category, commission_amount, referral_code, created_at) 
        VALUES (@sale_id, @user_id, @amount, @category, @commission_amount, @referral_code, @created_at)`);
    
    // Update affiliate commission balance
    const affiliateResult = await request
      .input('ref_code', mssql.VarChar, referral_code)
      .query('SELECT user_id FROM affiliates WHERE referral_code = @ref_code');
    
    if (affiliateResult.recordset.length > 0) {
      const affiliateUserId = affiliateResult.recordset[0].user_id;
      await request
        .input('affiliate_user_id', mssql.VarChar, affiliateUserId)
        .input('commission_balance', mssql.Numeric(15,2), commissionAmount)
        .query(`UPDATE affiliates SET total_commissions = total_commissions + @commission_balance 
          WHERE user_id = @affiliate_user_id`);
    }
    
    res.json({ success: true, sale_id: saleId, commission_amount: commissionAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Affiliate Commission Report
app.get('/api/affiliates/report', authenticateToken, async (req, res) => {
  try {
    const request = connectionPool.request();
    const result = await request
      .input('user_id', mssql.VarChar, req.user.user_id)
      .query(`SELECT s.*, a.referral_code FROM sales s 
        JOIN affiliates a ON s.referral_code = a.referral_code 
        WHERE a.user_id = @user_id`);
    
    const sales = result.recordset;
    const totalCommissions = sales.reduce((sum, s) => sum + s.commission_amount, 0);
    
    res.json({ sales, total_commissions: totalCommissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Export Commission Report (Excel)
app.get('/api/affiliates/export/excel', authenticateToken, async (req, res) => {
  try {
    const request = connectionPool.request();
    const result = await request
      .input('user_id', mssql.VarChar, req.user.user_id)
      .query(`SELECT s.*, a.referral_code FROM sales s 
        JOIN affiliates a ON s.referral_code = a.referral_code 
        WHERE a.user_id = @user_id`);
    
    const wb = new excel.Workbook();
    const ws = wb.addWorksheet('Commissions');
    
    ws.cell(1, 1).string('Sale ID');
    ws.cell(1, 2).string('Date');
    ws.cell(1, 3).string('Amount');
    ws.cell(1, 4).string('Commission');
    ws.cell(1, 5).string('Category');
    
    result.recordset.forEach((row, idx) => {
      ws.cell(idx + 2, 1).string(row.sale_id);
      ws.cell(idx + 2, 2).string(row.created_at.toISOString());
      ws.cell(idx + 2, 3).number(row.amount);
      ws.cell(idx + 2, 4).number(row.commission_amount);
      ws.cell(idx + 2, 5).string(row.category);
    });
    
    res.setHeader('Content-Disposition', 'attachment; filename=commissions.xlsx');
    wb.write('commissions.xlsx', res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PHASE 3: LOTTERY POOL SYSTEM ====================

// Check if Lottery Threshold Reached
app.post('/api/lottery/check-threshold', async (req, res) => {
  try {
    const { revenue_threshold } = req.body;
    const request = connectionPool.request();
    
    const result = await request.query(`SELECT SUM(amount) as total_revenue FROM sales`);
    const totalRevenue = result.recordset[0]?.total_revenue || 0;
    
    if (totalRevenue >= revenue_threshold) {
      // Generate lottery entries
      const affiliateResult = await request.query(`SELECT user_id, total_commissions FROM affiliates`);
      const entries = [];
      
      affiliateResult.recordset.forEach(affiliate => {
        const affiliateEntries = Math.floor(affiliate.total_commissions / 10000);
        for (let i = 0; i < affiliateEntries; i++) {
          entries.push({ user_id: affiliate.user_id, entry_type: 'affiliate' });
        }
      });
      
      // Get consumer entries (points-based)
      const consumerResult = await request.query(`SELECT user_id, points FROM users WHERE points >= 10`);
      consumerResult.recordset.forEach(user => {
        const consumerEntries = Math.floor(user.points / 10);
        for (let i = 0; i < consumerEntries; i++) {
          entries.push({ user_id: user.user_id, entry_type: 'consumer' });
        }
      });
      
      res.json({ threshold_reached: true, total_entries: entries.length, entries });
    } else {
      res.json({ threshold_reached: false, current_revenue: totalRevenue });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Execute Lottery Drawing
app.post('/api/lottery/draw', async (req, res) => {
  try {
    const { prize_tiers } = req.body; // [{prize: 50000, count: 2}, ...]
    const request = connectionPool.request();
    
    // Get all eligible entries
    const entriesResult = await request.query(
      `SELECT DISTINCT user_id FROM (SELECT user_id FROM affiliates UNION SELECT user_id FROM users WHERE points >= 10) as eligible`);
    
    const winners = [];
    let prizeIndex = 0;
    
    prize_tiers.forEach(tier => {
      for (let i = 0; i < tier.count; i++) {
        const randomIdx = Math.floor(Math.random() * entriesResult.recordset.length);
        const winner = entriesResult.recordset[randomIdx];
        const tax = tier.prize > 20000 ? tier.prize * 0.10 : 0;
        
        winners.push({
          user_id: winner.user_id,
          prize_amount: tier.prize,
          tax_withheld: tax,
          net_amount: tier.prize - tax
        });
      }
    });
    
    // Record lottery drawing
    const drawingId = uuidv4();
    await request
      .input('drawing_id', mssql.VarChar, drawingId)
      .input('created_at', mssql.DateTime, new Date())
      .query(`INSERT INTO lottery_drawings (drawing_id, created_at) VALUES (@drawing_id, @created_at)`);
    
    // Record winners
    for (const winner of winners) {
      await request
        .input('winner_id', mssql.VarChar, uuidv4())
        .input('drawing_id2', mssql.VarChar, drawingId)
        .input('user_id2', mssql.VarChar, winner.user_id)
        .input('prize_amount', mssql.Numeric(15,2), winner.prize_amount)
        .input('tax_withheld', mssql.Numeric(15,2), winner.tax_withheld)
        .query(`INSERT INTO lottery_winners (winner_id, drawing_id, user_id, prize_amount, tax_withheld, status) 
          VALUES (@winner_id, @drawing_id2, @user_id2, @prize_amount, @tax_withheld, 'pending')`);
    }
    
    res.json({ success: true, drawing_id: drawingId, winners_count: winners.length, winners });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Lottery Winners
app.get('/api/lottery/winners', async (req, res) => {
  try {
    const request = connectionPool.request();
    const result = await request.query(
      `SELECT lw.*, u.email FROM lottery_winners lw JOIN users u ON lw.user_id = u.user_id`);
    
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PAYMENT GATEWAYS ====================

// LINE Pay Payment
app.post('/api/payments/line-pay', authenticateToken, async (req, res) => {
  try {
    const { amount, product_id } = req.body;
    
    const linePayConfig = {
      channelId: process.env.LINE_PAY_CHANNEL_ID,
      channelSecret: process.env.LINE_PAY_CHANNEL_SECRET
    };
    
    const linePayResponse = await axios.post('https://api.line.me/v2/payments/request', {
      amount: amount,
      currency: 'TWD',
      orderId: uuidv4(),
      packages: [{
        id: product_id,
        amount: amount,
        products: [{ name: 'Product', quantity: 1, price: amount }]
      }],
      redirectUrls: {
        confirmUrl: 'https://www.teamtogetherstore.com/api/payments/line-pay/confirm',
        cancelUrl: 'https://www.teamtogetherstore.com/api/payments/line-pay/cancel'
      }
    }, {
      headers: {
        'X-LINE-ChannelId': linePayConfig.channelId,
        'X-LINE-ChannelSecret': linePayConfig.channelSecret
      }
    });
    
    res.json({ payment_url: linePayResponse.data.info.paymentUrl.web });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ECPay Payment
app.post('/api/payments/ecpay', authenticateToken, async (req, res) => {
  try {
    const { amount, product_id } = req.body;
    const orderId = `ECPay_${Date.now()}`;
    
    res.json({ 
      success: true, 
      order_id: orderId,
      message: 'ECPay integration placeholder - implement with ecpay SDK'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Stripe Webhook for Payment Confirmation
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpoint_secret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  try {
    event = Stripe(process.env.STRIPE_SECRET_KEY).webhooks.constructEvent(req.body, sig, endpoint_secret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  if (event.type === 'charge.succeeded') {
    console.log('Payment successful:', event.data.object);
  }
  
  res.json({received: true});
};

// ==================== LINE BOT INTEGRATION ====================

const lineClient = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

// LINE Bot Message Handler
app.post('/api/line-bot/webhook', line.middleware({channelSecret: process.env.LINE_CHANNEL_SECRET}), async (req, res) => {
  const events = req.body.events;
  
  Promise.all(events.map(async (event) => {
    if (event.type === 'follow') {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '🙏 感謝您關注Team Together!\n歡迎來到靈性成長社群。'
      });
    }
  })).catch(err => console.error(err));
  
  res.sendStatus(200);
});

// LINE Bot Push Messages - Daily Fortune
app.post('/api/line-bot/push-fortune', authenticateToken, async (req, res) => {
  try {
    const request = connectionPool.request();
    const usersResult = await request.query(`SELECT line_user_id FROM users WHERE line_user_id IS NOT NULL`);
    
    const fortunes = ['今日運勢：吉', '今日運勢：中吉', '今日運勢：小吉'];
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    
    for (const user of usersResult.recordset) {
      await lineClient.pushMessage(user.line_user_id, {
        type: 'text',
        text: `早安🌅\n${fortune}\n\n祝您有美好的一天!`
      });
    }
    
    res.json({ success: true, users_notified: usersResult.recordset.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// LINE Bot Push Messages - Bedtime Reminder
app.post('/api/line-bot/push-reminder', authenticateToken, async (req, res) => {
  try {
    const request = connectionPool.request();
    const usersResult = await request.query(`SELECT line_user_id FROM users WHERE line_user_id IS NOT NULL`);
    
    for (const user of usersResult.recordset) {
      await lineClient.pushMessage(user.line_user_id, {
        type: 'template',
        altText: '晚安提醒',
        template: {
          type: 'buttons',
          text: '🌙 晚安提醒\n\n今天感謝了什麼呢?',
          actions: [
            { type: 'message', label: '我想記錄', text: '今天感謝...' }
          ]
        }
      });
    }
    
    res.json({ success: true, users_notified: usersResult.recordset.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// LINE Bot Order Confirmation
app.post('/api/line-bot/order-notification', async (req, res) => {
  try {
    const { user_line_id, order_id, amount } = req.body;
    
    await lineClient.pushMessage(user_line_id, {
      type: 'text',
      text: `✅ 訂單確認\n訂單編號: ${order_id}\n金額: NT$${amount}\n\n感謝您的購買!`
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// LINE Pay Direct Booking to Order
app.post('/api/line-bot/direct-booking', authenticateToken, async (req, res) => {
  try {
    const { service_id, booking_date, line_user_id } = req.body;
    const orderId = uuidv4();
    
    const request = connectionPool.request();
    
    // Create booking
    await request
      .input('order_id', mssql.VarChar, orderId)
      .input('user_id', mssql.VarChar, req.user.user_id)
      .input('service_id', mssql.VarChar, service_id)
      .input('booking_date', mssql.DateTime, new Date(booking_date))
      .input('status', mssql.VarChar, 'pending')
      .input('created_at', mssql.DateTime, new Date())
      .query(`INSERT INTO bookings (order_id, user_id, service_id, booking_date, status, created_at) 
        VALUES (@order_id, @user_id, @service_id, @booking_date, @status, @created_at)`);
    
    // Send LINE confirmation
    await lineClient.pushMessage(line_user_id, {
      type: 'text',
      text: `📅 預約確認\n預約編號: ${orderId}\n日期: ${booking_date}\n\n等候您的蒞臨!`
    });
    
    res.json({ success: true, order_id: orderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Team Together Platform API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
