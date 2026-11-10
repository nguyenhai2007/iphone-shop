
// ============================================
// HẢI APPLE STORE - BACKEND SERVER
// EXPRESS + POSTGRESQL + JWT
// LOCAL + VERCEL
// ============================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const { pool, initDatabase } = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.warn("CANH BAO: Chua cau hinh JWT_SECRET!");
}

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(express.static(path.join(__dirname, "../public")));

app.disable("x-powered-by");

// ============================================
// HÀM HỖ TRỢ
// ============================================

function sendError(res, status, message) {
    return res.status(status).json({
        success: false,
        message
    });
}

function createToken(user) {
    if (!JWT_SECRET) {
        throw new Error("Chua cau hinh JWT_SECRET!");
    }

    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: "2h" }
    );
}

function safeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    };
}

function verifyToken(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
        return sendError(res, 401, "Vui lòng đăng nhập!");
    }

    try {
        const token = authorization.split(" ")[1];

        req.user = jwt.verify(token, JWT_SECRET);

        next();
    } catch (error) {
        return sendError(
            res,
            401,
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!"
        );
    }
}

function verifyAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return sendError(
            res,
            403,
            "Bạn không có quyền thực hiện thao tác này!"
        );
    }

    next();
}

function validId(value) {
    return /^\d+$/.test(String(value)) &&
        BigInt(value) > 0n;
}

function validPrice(value) {
    return (
        value !== "" &&
        value !== null &&
        value !== undefined &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    );
}

function normalizeProduct(product) {
    return {
        name: String(product.name || "").trim(),
        price: Number(product.price),
        image: String(product.image || "").trim(),
        description: String(product.description || "").trim(),
        category: String(product.category || "iPhone").trim(),
        stock: Number(product.stock ?? 100),
        original_price: Number(product.original_price ?? 0),
        featured: Number(product.featured ?? 0) ? 1 : 0
    };
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================
// KIỂM TRA SERVER
// ============================================

app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "HẢI APPLE STORE API đang hoạt động!",
        version: "4.0",
        database: "PostgreSQL"
    });
});

// ============================================
// ĐĂNG KÝ
// ============================================

app.post("/api/register", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!name || !email || !password) {
            return sendError(res, 400, "Vui lòng nhập đầy đủ thông tin!");
        }

        if (name.length > 100) {
            return sendError(res, 400, "Tên không được quá 100 ký tự!");
        }

        if (!isValidEmail(email)) {
            return sendError(res, 400, "Email không hợp lệ!");
        }

        if (password.length < 6 || password.length > 72) {
            return sendError(
                res,
                400,
                "Mật khẩu phải từ 6 đến 72 ký tự!"
            );
        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rowCount > 0) {
            return sendError(res, 409, "Email đã được đăng ký!");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password, role)
             VALUES ($1, $2, $3, 'user')
             RETURNING id, name, email, role`,
            [name, email, hashedPassword]
        );

        const user = result.rows[0];

        res.status(201).json({
            success: true,
            message: "Đăng ký tài khoản thành công!",
            token: createToken(user),
            user: safeUser(user)
        });

    } catch (error) {
        console.error("REGISTER ERROR:", error);

        if (error.code === "23505") {
            return sendError(res, 409, "Email đã được đăng ký!");
        }

        sendError(res, 500, "Không thể đăng ký tài khoản!");
    }
});

// ============================================
// ĐĂNG NHẬP
// ============================================

app.post("/api/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!email || !password) {
            return sendError(
                res,
                400,
                "Vui lòng nhập email và mật khẩu!"
            );
        }

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        const user = result.rows[0];

        if (!user) {
            return sendError(
                res,
                401,
                "Email hoặc mật khẩu không chính xác!"
            );
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return sendError(
                res,
                401,
                "Email hoặc mật khẩu không chính xác!"
            );
        }

        res.json({
            success: true,
            message: "Đăng nhập thành công!",
            token: createToken(user),
            user: safeUser(user)
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        sendError(res, 500, "Không thể đăng nhập!");
    }
});

// ============================================
// THÔNG TIN TÀI KHOẢN
// ============================================

app.get("/api/me", verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        const user = result.rows[0];

        if (!user) {
            return sendError(res, 404, "Không tìm thấy tài khoản!");
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error("ME ERROR:", error);
        sendError(res, 500, "Không thể tải thông tin tài khoản!");
    }
});

// ============================================
// DANH SÁCH SẢN PHẨM
// ============================================

app.get("/api/products", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM products
            ORDER BY featured DESC, id DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("PRODUCT ERROR:", error);
        sendError(res, 500, "Không thể tải sản phẩm!");
    }
});

// ============================================
// CHI TIẾT SẢN PHẨM
// ============================================

app.get("/api/products/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "ID sản phẩm không hợp lệ!");
        }

        const result = await pool.query(
            "SELECT * FROM products WHERE id = $1",
            [req.params.id]
        );

        const product = result.rows[0];

        if (!product) {
            return sendError(res, 404, "Không tìm thấy sản phẩm!");
        }

        res.json(product);

    } catch (error) {
        console.error("PRODUCT DETAIL ERROR:", error);
        sendError(res, 500, "Không thể tải chi tiết sản phẩm!");
    }
});

// ============================================
// THÊM SẢN PHẨM - ADMIN
// ============================================

app.post("/api/products", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const product = normalizeProduct(req.body);

        if (!product.name || !validPrice(product.price)) {
            return sendError(
                res,
                400,
                "Tên hoặc giá sản phẩm không hợp lệ!"
            );
        }

        if (
            !Number.isInteger(product.stock) ||
            product.stock < 0 ||
            !validPrice(product.original_price)
        ) {
            return sendError(
                res,
                400,
                "Số lượng hoặc giá gốc không hợp lệ!"
            );
        }

        const result = await pool.query(
            `INSERT INTO products (
                name, price, image, description,
                category, stock, original_price, featured
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                product.name,
                product.price,
                product.image,
                product.description,
                product.category,
                product.stock,
                product.original_price,
                product.featured
            ]
        );

        res.status(201).json({
            success: true,
            message: "Thêm sản phẩm thành công!",
            product: result.rows[0]
        });

    } catch (error) {
        console.error("ADD PRODUCT ERROR:", error);
        sendError(res, 500, "Không thể thêm sản phẩm!");
    }
});

// ============================================
// CẬP NHẬT SẢN PHẨM - ADMIN
// ============================================

app.put("/api/products/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "ID sản phẩm không hợp lệ!");
        }

        const product = normalizeProduct(req.body);

        if (!product.name || !validPrice(product.price)) {
            return sendError(
                res,
                400,
                "Tên hoặc giá sản phẩm không hợp lệ!"
            );
        }

        if (
            !Number.isInteger(product.stock) ||
            product.stock < 0 ||
            !validPrice(product.original_price)
        ) {
            return sendError(
                res,
                400,
                "Số lượng hoặc giá gốc không hợp lệ!"
            );
        }

        const result = await pool.query(
            `UPDATE products
             SET name = $1,
                 price = $2,
                 image = $3,
                 description = $4,
                 category = $5,
                 stock = $6,
                 original_price = $7,
                 featured = $8,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $9
             RETURNING id`,
            [
                product.name,
                product.price,
                product.image,
                product.description,
                product.category,
                product.stock,
                product.original_price,
                product.featured,
                req.params.id
            ]
        );

        if (result.rowCount === 0) {
            return sendError(res, 404, "Không tìm thấy sản phẩm!");
        }

        res.json({
            success: true,
            message: "Cập nhật sản phẩm thành công!"
        });

    } catch (error) {
        console.error("UPDATE PRODUCT ERROR:", error);
        sendError(res, 500, "Không thể cập nhật sản phẩm!");
    }
});

// ============================================
// XÓA SẢN PHẨM - ADMIN
// ============================================

app.delete("/api/products/:id", verifyToken, verifyAdmin, async (req, res) => {
    let client;

    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "ID sản phẩm không hợp lệ!");
        }

        client = await pool.connect();

        const product = await client.query(
            "SELECT id FROM products WHERE id = $1",
            [req.params.id]
        );

        if (product.rowCount === 0) {
            return sendError(res, 404, "Không tìm thấy sản phẩm!");
        }

        const usedInOrder = await client.query(
            `SELECT id FROM order_items
             WHERE product_id = $1
             LIMIT 1`,
            [req.params.id]
        );

        if (usedInOrder.rowCount > 0) {
            return sendError(
                res,
                409,
                "Sản phẩm đã có trong đơn hàng. Hãy ngừng kinh doanh thay vì xóa."
            );
        }

        await client.query(
            "DELETE FROM products WHERE id = $1",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Đã xóa sản phẩm!"
        });

    } catch (error) {
        console.error("DELETE PRODUCT ERROR:", error);
        sendError(res, 500, "Không thể xóa sản phẩm!");
    } finally {
        if (client) client.release();
    }
});

// ============================================
// TẠO ĐƠN HÀNG
// ============================================

app.post("/api/orders", verifyToken, async (req, res) => {
    let client;

    try {
        const {
            fullname,
            phone,
            address,
            payment,
            products,
            note
        } = req.body;

        const customerName = String(fullname || "").trim();
        const customerPhone = String(phone || "").trim();
        const customerAddress = String(address || "").trim();

        if (!customerName || !customerPhone || !customerAddress) {
            return sendError(
                res,
                400,
                "Vui lòng nhập đầy đủ thông tin nhận hàng!"
            );
        }

        if (!/^\d{10,11}$/.test(customerPhone)) {
            return sendError(res, 400, "Số điện thoại không hợp lệ!");
        }

        if (!["COD", "BANK"].includes(payment)) {
            return sendError(
                res,
                400,
                "Phương thức thanh toán không hợp lệ!"
            );
        }

        if (!Array.isArray(products) || products.length === 0) {
            return sendError(res, 400, "Giỏ hàng đang trống!");
        }

        if (products.length > 50) {
            return sendError(
                res,
                400,
                "Giỏ hàng có quá nhiều sản phẩm!"
            );
        }

        client = await pool.connect();

        await client.query("BEGIN");

        const orderProducts = [];
        let total = 0;

        for (const item of products) {
            const productId = Number(item.product_id ?? item.id);
            const quantity = Number(item.quantity);

            if (
                !Number.isInteger(productId) ||
                productId <= 0 ||
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                quantity > 100
            ) {
                throw new Error(
                    "Thông tin sản phẩm trong giỏ hàng không hợp lệ!"
                );
            }

            const productResult = await client.query(
                "SELECT * FROM products WHERE id = $1 FOR UPDATE",
                [productId]
            );

            const product = productResult.rows[0];

            if (!product) {
                throw new Error("Có sản phẩm không còn tồn tại!");
            }

            if (Number(product.stock) < quantity) {
                throw new Error(
                    `Sản phẩm ${product.name} không đủ số lượng trong kho!`
                );
            }

            orderProducts.push({
                product,
                quantity
            });

            total += Number(product.price) * quantity;
        }

        const orderResult = await client.query(
            `INSERT INTO orders (
                user_id, fullname, phone, address,
                payment, total, status, payment_status, note
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id`,
            [
                req.user.id,
                customerName,
                customerPhone,
                customerAddress,
                payment,
                total,
                "Đang xử lý",
                payment === "BANK"
                    ? "Chờ chuyển khoản"
                    : "Chưa thanh toán",
                String(note || "").trim()
            ]
        );

        const orderId = orderResult.rows[0].id;

        for (const item of orderProducts) {
            await client.query(
                `INSERT INTO order_items (
                    order_id, product_id, product_name, price, quantity
                )
                VALUES ($1, $2, $3, $4, $5)`,
                [
                    orderId,
                    item.product.id,
                    item.product.name,
                    item.product.price,
                    item.quantity
                ]
            );

            const stockResult = await client.query(
                `UPDATE products
                 SET stock = stock - $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2 AND stock >= $1`,
                [item.quantity, item.product.id]
            );

            if (stockResult.rowCount === 0) {
                throw new Error(
                    `Sản phẩm ${item.product.name} vừa hết hàng.`
                );
            }
        }

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            message: "Đặt hàng thành công!",
            orderId,
            total
        });

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK");
        }

        console.error("CREATE ORDER ERROR:", error);

        sendError(
            res,
            400,
            error.message || "Không thể tạo đơn hàng!"
        );
    } finally {
        if (client) client.release();
    }
});

// ============================================
// BÁO ĐÃ CHUYỂN KHOẢN
// ============================================

app.post(
    "/api/orders/:id/report-transfer",
    verifyToken,
    async (req, res) => {
        try {
            if (!validId(req.params.id)) {
                return sendError(res, 400, "Mã đơn hàng không hợp lệ!");
            }

            const result = await pool.query(
                `SELECT *
                 FROM orders
                 WHERE id = $1 AND user_id = $2`,
                [req.params.id, req.user.id]
            );

            const order = result.rows[0];

            if (!order) {
                return sendError(res, 404, "Không tìm thấy đơn hàng!");
            }

            if (order.payment !== "BANK") {
                return sendError(
                    res,
                    400,
                    "Đơn hàng không sử dụng chuyển khoản!"
                );
            }

            if (order.payment_status === "Đã thanh toán") {
                return sendError(
                    res,
                    400,
                    "Đơn hàng đã được xác nhận thanh toán!"
                );
            }

            await pool.query(
                `UPDATE orders
                 SET payment_status = $1,
                     transfer_reported_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                ["Chờ kiểm tra", order.id]
            );

            res.json({
                success: true,
                message: "Đã gửi thông báo chuyển khoản. Cửa hàng sẽ kiểm tra!"
            });

        } catch (error) {
            console.error("TRANSFER ERROR:", error);
            sendError(
                res,
                500,
                "Không thể gửi thông báo chuyển khoản!"
            );
        }
    }
);

// ============================================
// LỊCH SỬ ĐƠN HÀNG CỦA KHÁCH
// ============================================

app.get("/api/my-orders", verifyToken, async (req, res) => {
    try {
        const ordersResult = await pool.query(
            `SELECT *
             FROM orders
             WHERE user_id = $1
             ORDER BY id DESC`,
            [req.user.id]
        );

        const orders = ordersResult.rows;

        for (const order of orders) {
            const itemsResult = await pool.query(
                `SELECT *
                 FROM order_items
                 WHERE order_id = $1`,
                [order.id]
            );

            order.products = itemsResult.rows;
        }

        res.json(orders);

    } catch (error) {
        console.error("MY ORDERS ERROR:", error);
        sendError(res, 500, "Không thể tải lịch sử đơn hàng!");
    }
});

// ============================================
// DANH SÁCH ĐƠN HÀNG - ADMIN
// ============================================

app.get(
    "/api/admin/orders",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const ordersResult = await pool.query(`
                SELECT
                    orders.*,
                    users.email AS email
                FROM orders
                LEFT JOIN users ON orders.user_id = users.id
                ORDER BY orders.id DESC
            `);

            const orders = ordersResult.rows;

            for (const order of orders) {
                const itemsResult = await pool.query(
                    `SELECT *
                     FROM order_items
                     WHERE order_id = $1`,
                    [order.id]
                );

                order.products = itemsResult.rows;
            }

            res.json(orders);

        } catch (error) {
            console.error("ADMIN ORDERS ERROR:", error);
            sendError(res, 500, "Không thể tải đơn hàng!");
        }
    }
);

// ============================================
// CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG - ADMIN
// ============================================

app.put(
    "/api/admin/orders/:id/status",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        let client;

        try {
            const allowedStatuses = [
                "Đang xử lý",
                "Đã xác nhận",
                "Đang giao hàng",
                "Đã giao hàng",
                "Đã hủy"
            ];

            const status = String(req.body.status || "");

            if (!validId(req.params.id)) {
                return sendError(res, 400, "Mã đơn hàng không hợp lệ!");
            }

            if (!allowedStatuses.includes(status)) {
                return sendError(
                    res,
                    400,
                    "Trạng thái đơn hàng không hợp lệ!"
                );
            }

            client = await pool.connect();

            await client.query("BEGIN");

            const orderResult = await client.query(
                "SELECT * FROM orders WHERE id = $1 FOR UPDATE",
                [req.params.id]
            );

            const order = orderResult.rows[0];

            if (!order) {
                await client.query("ROLLBACK");

                return sendError(
                    res,
                    404,
                    "Không tìm thấy đơn hàng!"
                );
            }

            if (order.status === "Đã hủy" && status !== "Đã hủy") {
                await client.query("ROLLBACK");

                return sendError(
                    res,
                    400,
                    "Đơn hàng đã hủy không thể khôi phục!"
                );
            }

            if (status === "Đã hủy" && order.status !== "Đã hủy") {
                const itemsResult = await client.query(
                    `SELECT product_id, quantity
                     FROM order_items
                     WHERE order_id = $1`,
                    [order.id]
                );

                for (const item of itemsResult.rows) {
                    if (item.product_id) {
                        await client.query(
                            `UPDATE products
                             SET stock = stock + $1,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE id = $2`,
                            [item.quantity, item.product_id]
                        );
                    }
                }
            }

            await client.query(
                `UPDATE orders
                 SET status = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [status, order.id]
            );

            await client.query("COMMIT");

            res.json({
                success: true,
                message: "Đã cập nhật trạng thái đơn hàng!"
            });

        } catch (error) {
            if (client) {
                await client.query("ROLLBACK");
            }

            console.error("UPDATE ORDER STATUS ERROR:", error);

            sendError(
                res,
                500,
                "Không thể cập nhật trạng thái đơn hàng!"
            );
        } finally {
            if (client) client.release();
        }
    }
);

// ============================================
// CẬP NHẬT TRẠNG THÁI THANH TOÁN - ADMIN
// ============================================

app.put(
    "/api/admin/orders/:id/payment-status",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const allowedStatuses = [
                "Chờ chuyển khoản",
                "Chờ kiểm tra",
                "Đã thanh toán",
                "Chưa thanh toán"
            ];

            const status = String(req.body.payment_status || "");

            if (!validId(req.params.id)) {
                return sendError(res, 400, "Mã đơn hàng không hợp lệ!");
            }

            if (!allowedStatuses.includes(status)) {
                return sendError(
                    res,
                    400,
                    "Trạng thái thanh toán không hợp lệ!"
                );
            }

            const result = await pool.query(
                `UPDATE orders
                 SET payment_status = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [status, req.params.id]
            );

            if (result.rowCount === 0) {
                return sendError(
                    res,
                    404,
                    "Không tìm thấy đơn hàng!"
                );
            }

            res.json({
                success: true,
                message: "Đã cập nhật thanh toán!"
            });

        } catch (error) {
            console.error("UPDATE PAYMENT ERROR:", error);
            sendError(res, 500, "Không thể cập nhật thanh toán!");
        }
    }
);

// ============================================
// THỐNG KÊ ADMIN
// ============================================

app.get(
    "/api/admin/statistics",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const productsResult = await pool.query(`
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COALESCE(SUM(stock), 0)::INTEGER AS stock
                FROM products
            `);

            const usersResult = await pool.query(`
                SELECT COUNT(*)::INTEGER AS total
                FROM users
                WHERE role = 'user'
            `);

            const ordersResult = await pool.query(`
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN status = 'Đã giao hàng'
                                AND (
                                    payment = 'COD'
                                    OR payment_status = 'Đã thanh toán'
                                )
                                THEN total
                                ELSE 0
                            END
                        ),
                        0
                    )::FLOAT8 AS revenue
                FROM orders
            `);

            res.json({
                success: true,
                products: productsResult.rows[0],
                users: usersResult.rows[0],
                orders: ordersResult.rows[0]
            });

        } catch (error) {
            console.error("STATISTICS ERROR:", error);
            sendError(res, 500, "Không thể tải thống kê!");
        }
    }
);

// ============================================
// DANH SÁCH ĐÁNH GIÁ SẢN PHẨM
// ============================================

app.get("/api/products/:id/reviews", async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "ID sản phẩm không hợp lệ!");
        }

        const result = await pool.query(
            `SELECT
                reviews.id,
                reviews.product_id,
                reviews.rating,
                reviews.comment,
                reviews.created_at,
                users.name AS user_name
             FROM reviews
             JOIN users ON reviews.user_id = users.id
             WHERE reviews.product_id = $1
             ORDER BY reviews.id DESC`,
            [req.params.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("GET REVIEWS ERROR:", error);
        sendError(res, 500, "Không thể tải đánh giá!");
    }
});

// ============================================
// THÊM ĐÁNH GIÁ - KHÁCH ĐÃ MUA SẢN PHẨM
// ============================================

app.post(
    "/api/products/:id/reviews",
    verifyToken,
    async (req, res) => {
        try {
            const productId = Number(req.params.id);
            const rating = Number(req.body.rating);
            const comment = String(req.body.comment || "").trim();

            if (!validId(productId)) {
                return sendError(
                    res,
                    400,
                    "ID sản phẩm không hợp lệ!"
                );
            }

            if (
                !Number.isInteger(rating) ||
                rating < 1 ||
                rating > 5
            ) {
                return sendError(
                    res,
                    400,
                    "Đánh giá phải từ 1 đến 5 sao!"
                );
            }

            if (!comment || comment.length > 1000) {
                return sendError(
                    res,
                    400,
                    "Nội dung đánh giá không hợp lệ!"
                );
            }

            const productResult = await pool.query(
                "SELECT id FROM products WHERE id = $1",
                [productId]
            );

            if (productResult.rowCount === 0) {
                return sendError(
                    res,
                    404,
                    "Không tìm thấy sản phẩm!"
                );
            }

            const purchaseResult = await pool.query(
                `SELECT orders.id
                 FROM orders
                 JOIN order_items ON orders.id = order_items.order_id
                 WHERE orders.user_id = $1
                   AND orders.status = 'Đã giao hàng'
                   AND order_items.product_id = $2
                 LIMIT 1`,
                [req.user.id, productId]
            );

            const purchase = purchaseResult.rows[0];

            if (!purchase) {
                return sendError(
                    res,
                    403,
                    "Bạn cần mua và nhận sản phẩm trước khi đánh giá!"
                );
            }

            const alreadyReviewed = await pool.query(
                `SELECT id
                 FROM reviews
                 WHERE user_id = $1 AND product_id = $2
                 LIMIT 1`,
                [req.user.id, productId]
            );

            if (alreadyReviewed.rowCount > 0) {
                return sendError(
                    res,
                    409,
                    "Bạn đã đánh giá sản phẩm này!"
                );
            }

            await pool.query(
                `INSERT INTO reviews (
                    product_id, user_id, order_id, rating, comment
                )
                VALUES ($1, $2, $3, $4, $5)`,
                [
                    productId,
                    req.user.id,
                    purchase.id,
                    rating,
                    comment
                ]
            );

            res.status(201).json({
                success: true,
                message: "Cảm ơn bạn đã đánh giá sản phẩm!"
            });

        } catch (error) {
            console.error("REVIEW ERROR:", error);

            if (error.code === "23505") {
                return sendError(
                    res,
                    409,
                    "Bạn đã đánh giá sản phẩm này!"
                );
            }

            sendError(res, 500, "Không thể gửi đánh giá!");
        }
    }
);

// ============================================
// XỬ LÝ ĐƯỜNG DẪN KHÔNG TỒN TẠI
// ============================================

app.use((req, res) => {
    sendError(res, 404, "Không tìm thấy đường dẫn yêu cầu!");
});

// ============================================
// XỬ LÝ LỖI
// ============================================

app.use((error, req, res, next) => {
    console.error("SERVER ERROR:", error);

    if (res.headersSent) {
        return next(error);
    }

    sendError(
        res,
        500,
        "Máy chủ gặp lỗi. Vui lòng thử lại!"
    );
});

// ============================================
// KHỞI ĐỘNG LOCAL VÀ EXPORT CHO VERCEL
// ============================================

async function startServer() {
    try {
        await initDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log("=================================");
            console.log("HẢI APPLE STORE");
            console.log(`Server đang chạy tại cổng ${PORT}`);
            console.log("PostgreSQL đã kết nối!");
            console.log("Backend đang hoạt động!");
            console.log("=================================");
        });

    } catch (error) {
        console.error("KHÔNG THỂ KHỞI ĐỘNG SERVER:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;
