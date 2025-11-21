-- Team Together Platform Database Schema
-- Azure SQL Database

-- Users Table
CREATE TABLE users (
    user_id NVARCHAR(36) PRIMARY KEY,
    email NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    subscription_tier NVARCHAR(50) DEFAULT '0',
    points INT DEFAULT 0,
    line_user_id NVARCHAR(255),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- Subscriptions Table
CREATE TABLE subscriptions (
    subscription_id NVARCHAR(36) PRIMARY KEY,
    user_id NVARCHAR(36) NOT NULL,
    tier NVARCHAR(50) NOT NULL,
    start_date DATETIME NOT NULL,
    expiry_date DATETIME NOT NULL,
    status NVARCHAR(50) DEFAULT 'active',
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Affiliates Table
CREATE TABLE affiliates (
    affiliate_id NVARCHAR(36) PRIMARY KEY,
    user_id NVARCHAR(36) NOT NULL UNIQUE,
    referral_code NVARCHAR(255) UNIQUE NOT NULL,
    commission_rate DECIMAL(5,4) DEFAULT 0.08,
    total_commissions DECIMAL(15,2) DEFAULT 0,
    monthly_bonus DECIMAL(15,2) DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Sales Table
CREATE TABLE sales (
    sale_id NVARCHAR(36) PRIMARY KEY,
    user_id NVARCHAR(36) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    category NVARCHAR(50) NOT NULL,
    commission_amount DECIMAL(15,2) NOT NULL,
    referral_code NVARCHAR(255),
    status NVARCHAR(50) DEFAULT 'completed',
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (referral_code) REFERENCES affiliates(referral_code)
);

-- Referral Sessions Table
CREATE TABLE referral_sessions (
    session_id NVARCHAR(36) PRIMARY KEY,
    referral_code NVARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (referral_code) REFERENCES affiliates(referral_code)
);

-- Lottery Drawings Table
CREATE TABLE lottery_drawings (
    drawing_id NVARCHAR(36) PRIMARY KEY,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- Lottery Winners Table
CREATE TABLE lottery_winners (
    winner_id NVARCHAR(36) PRIMARY KEY,
    drawing_id NVARCHAR(36) NOT NULL,
    user_id NVARCHAR(36) NOT NULL,
    prize_amount DECIMAL(15,2) NOT NULL,
    tax_withheld DECIMAL(15,2) DEFAULT 0,
    status NVARCHAR(50) DEFAULT 'pending',
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (drawing_id) REFERENCES lottery_drawings(drawing_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Bookings Table
CREATE TABLE bookings (
    order_id NVARCHAR(36) PRIMARY KEY,
    user_id NVARCHAR(36) NOT NULL,
    service_id NVARCHAR(36) NOT NULL,
    booking_date DATETIME NOT NULL,
    status NVARCHAR(50) DEFAULT 'pending',
    cancellation_fee DECIMAL(15,2) DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create Indexes for Performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_referral_code ON sales(referral_code);
CREATE INDEX idx_lottery_winners_user_id ON lottery_winners(user_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER trg_users_updated_at
ON users
AFTER UPDATE
AS BEGIN
    UPDATE users SET updated_at = GETDATE() WHERE user_id IN (SELECT user_id FROM inserted)
END;

CREATE TRIGGER trg_affiliates_updated_at
ON affiliates
AFTER UPDATE
AS BEGIN
    UPDATE affiliates SET updated_at = GETDATE() WHERE affiliate_id IN (SELECT affiliate_id FROM inserted)
END;
