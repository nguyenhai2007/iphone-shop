
// ============================================
// HẢI APPLE STORE - DATABASE
// SQLITE + BETTER-SQLITE3
// ============================================

const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

// Lưu database vào ổ đĩa riêng khi triển khai
const dbDirectory = process.env.DATA_DIR || __dirname;

const dbPath = path.join(dbDirectory, "iphone-shop.db");
const db = new Database(dbPath);

// ============================================
// CẤU HÌNH SQLITE
// ============================================

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// ============================================
// HÀM KIỂM TRA VÀ BỔ SUNG CỘT
// ============================================

function addColumnIfNotExists(table, column, definition) {
    const allowedTables = [
        "users",
        "products",
        "orders",
        "order_items"
    ];

    if (!allowedTables.includes(table)) {
        throw new Error("Tên bảng không hợp lệ: " + table);
    }

    const columns = db.prepare(
        `PRAGMA table_info("${table}")`
    ).all();

    const exists = columns.some(
        item => item.name === column
    );

    if (!exists) {
        db.exec(
            `ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`
        );

        console.log(`Đã bổ sung cột ${table}.${column}`);
    }
}

// ============================================
// TẠO CÁC BẢNG MỚI
// ============================================

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        image TEXT,
        description TEXT,
        category TEXT DEFAULT 'iPhone',
        stock INTEGER DEFAULT 100,
        original_price REAL DEFAULT 0,
        featured INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        fullname TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        payment TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'Đang xử lý',
        payment_status TEXT DEFAULT 'Chưa thanh toán',
        transfer_reported_at TEXT,
        coupon_code TEXT,
        discount REAL DEFAULT 0,
        shipping_fee REAL DEFAULT 0,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id)
            ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        order_id INTEGER,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        discount_type TEXT NOT NULL DEFAULT 'percent',
        discount_value REAL NOT NULL,
        min_order REAL DEFAULT 0,
        max_discount REAL,
        usage_limit INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupon_usages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coupon_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (coupon_id) REFERENCES coupons(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    );
`);

// ============================================
// NÂNG CẤP DATABASE CŨ
// Không xóa dữ liệu hiện tại
// ============================================

// PRODUCTS

addColumnIfNotExists("products", "description", "TEXT");

addColumnIfNotExists(
    "products", "category", "TEXT DEFAULT 'iPhone'"
);

addColumnIfNotExists(
    "products", "stock", "INTEGER DEFAULT 100"
);

addColumnIfNotExists(
    "products", "original_price", "REAL DEFAULT 0"
);

addColumnIfNotExists(
    "products", "featured", "INTEGER DEFAULT 0"
);

// Không dùng CURRENT_TIMESTAMP khi ALTER TABLE ADD COLUMN

addColumnIfNotExists("products", "created_at", "TEXT");

addColumnIfNotExists("products", "updated_at", "TEXT");

// USERS

addColumnIfNotExists("users", "created_at", "TEXT");

// ORDERS

addColumnIfNotExists(
    "orders",
    "payment_status",
    "TEXT DEFAULT 'Chưa thanh toán'"
);

addColumnIfNotExists(
    "orders", "transfer_reported_at", "TEXT"
);

addColumnIfNotExists(
    "orders", "coupon_code", "TEXT"
);

addColumnIfNotExists(
    "orders", "discount", "REAL DEFAULT 0"
);

addColumnIfNotExists(
    "orders", "shipping_fee", "REAL DEFAULT 0"
);

addColumnIfNotExists(
    "orders", "note", "TEXT"
);

addColumnIfNotExists("orders", "updated_at", "TEXT");

// ORDER ITEMS

addColumnIfNotExists(
    "order_items", "product_id", "INTEGER"
);

// ============================================
// CẬP NHẬT THỜI GIAN CHO DỮ LIỆU CŨ
// ============================================

db.exec(`
    UPDATE products
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL OR created_at = '';

    UPDATE products
    SET updated_at = CURRENT_TIMESTAMP
    WHERE updated_at IS NULL OR updated_at = '';

    UPDATE users
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL OR created_at = '';

    UPDATE orders
    SET updated_at = CURRENT_TIMESTAMP
    WHERE updated_at IS NULL OR updated_at = '';
`);

// ============================================
// TẠO INDEX
// ============================================

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_category
    ON products(category);

    CREATE INDEX IF NOT EXISTS idx_products_name
    ON products(name);

    CREATE INDEX IF NOT EXISTS idx_orders_user
    ON orders(user_id);

    CREATE INDEX IF NOT EXISTS idx_orders_created
    ON orders(created_at);

    CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders(status);

    CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON order_items(order_id);

    CREATE INDEX IF NOT EXISTS idx_reviews_product
    ON reviews(product_id);

    CREATE INDEX IF NOT EXISTS idx_coupons_code
    ON coupons(code);
`);

// ============================================
// TẠO ADMIN MẶC ĐỊNH NẾU CHƯA CÓ
// ============================================

const adminEmail = "admin@iphoneshop.com";

const existingAdmin = db.prepare(`
    SELECT id FROM users WHERE email = ?
`).get(adminEmail);

if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        throw new Error("Chưa cấu hình ADMIN_PASSWORD!");
    }

    const hashedPassword = bcrypt.hashSync(
        adminPassword,
        10
    );

    db.prepare(`
        INSERT INTO users (
            name,
            email,
            password,
            role
        )
        VALUES (?, ?, ?, ?)
    `).run(
        "Administrator",
        adminEmail,
        hashedPassword,
        "admin"
    );

    console.log("Đã tạo tài khoản Admin mặc định.");
}

// ============================================
// KIỂM TRA DATABASE
// ============================================

db.prepare("PRAGMA foreign_key_check").all();

console.log("=================================");
console.log("HẢI APPLE STORE DATABASE READY");
console.log("SQLite:", dbPath);
console.log("=================================");

// ============================================
// EXPORT DATABASE
// ============================================

module.exports = db;
