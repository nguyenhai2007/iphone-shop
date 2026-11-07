
// ============================================
// HẢI APPLE STORE - BACKEND SERVER
// EXPRESS + SQLITE + JWT
// ============================================

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET =
    process.env.JWT_SECRET || "iphone-shop-dev-secret-change-me";

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

    const token = authorization.split(" ")[1];

    try {
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
    return Number.isInteger(Number(value)) && Number(value) > 0;
}

function validPrice(value) {
    return Number.isFinite(Number(value)) && Number(value) >= 0;
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

// ============================================
// TRANG KIỂM TRA SERVER
// ============================================

app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "HẢI APPLE STORE API đang hoạt động!",
        version: "2.0"
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

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return sendError(res, 400, "Email không hợp lệ!");
        }

        if (password.length < 6 || password.length > 72) {
            return sendError(
                res,
                400,
                "Mật khẩu phải từ 6 đến 72 ký tự!"
            );
        }

        const existingUser = db.prepare(
            "SELECT id FROM users WHERE email = ?"
        ).get(email);

        if (existingUser) {
            return sendError(res, 409, "Email đã được đăng ký!");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = db.prepare(`
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, 'user')
        `).run(name, email, hashedPassword);

        const user = db.prepare(
            "SELECT * FROM users WHERE id = ?"
        ).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: "Đăng ký tài khoản thành công!",
            token: createToken(user),
            user: safeUser(user)
        });
    } catch (error) {
        console.error("REGISTER ERROR:", error);
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
            return sendError(res, 400, "Vui lòng nhập email và mật khẩu!");
        }

        const user = db.prepare(
            "SELECT * FROM users WHERE email = ?"
        ).get(email);

        if (!user) {
            return sendError(res, 401, "Email hoặc mật khẩu không chính xác!");
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return sendError(res, 401, "Email hoặc mật khẩu không chính xác!");
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

app.get("/api/me", verifyToken, (req, res) => {
    const user = db.prepare(`
        SELECT id, name, email, role
        FROM users
        WHERE id = ?
    `).get(req.user.id);

    if (!user) {
        return sendError(res, 404, "Không tìm thấy tài khoản!");
    }

    res.json({
        success: true,
        user
    });
});

// ============================================
// DANH SÁCH SẢN PHẨM
// ============================================

app.get("/api/products", (req, res) => {
    try {
        const products = db.prepare(`
            SELECT *
            FROM products
            ORDER BY featured DESC, id DESC
        `).all();

        res.json(products);
    } catch (error) {
        console.error("PRODUCT ERROR:", error);
        sendError(res, 500, "Không thể tải sản phẩm!");
    }
});

// ============================================
// CHI TIẾT SẢN PHẨM
// ============================================

app.get("/api/products/:id", (req, res) => {
    if (!validId(req.params.id)) {
        return sendError(res, 400, "ID sản phẩm không hợp lệ!");
    }

    const product = db.prepare(
        "SELECT * FROM products WHERE id = ?"
    ).get(req.params.id);

    if (!product) {
        return sendError(res, 404, "Không tìm thấy sản phẩm!");
    }

    res.json(product);
});

// ============================================
// THÊM SẢN PHẨM - ADMIN
// ============================================

app.post("/api/products", verifyToken, verifyAdmin, (req, res) => {
    try {
        const product = normalizeProduct(req.body);

        if (!product.name || !validPrice(product.price)) {
            return sendError(res, 400, "Tên hoặc giá sản phẩm không hợp lệ!");
        }

        if (
            !Number.isInteger(product.stock) ||
            product.stock < 0 ||
            !validPrice(product.original_price)
        ) {
            return sendError(res, 400, "Số lượng hoặc giá gốc không hợp lệ!");
        }

        const result = db.prepare(`
            INSERT INTO products (
                name, price, image, description,
                category, stock, original_price, featured
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            product.name,
            product.price,
            product.image,
            product.description,
            product.category,
            product.stock,
            product.original_price,
            product.featured
        );

        const savedProduct = db.prepare(
            "SELECT * FROM products WHERE id = ?"
        ).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: "Thêm sản phẩm thành công!",
            product: savedProduct
        });
    } catch (error) {
        console.error("ADD PRODUCT ERROR:", error);
        sendError(res, 500, "Không thể thêm sản phẩm!");
    }
});

// ============================================
// CẬP NHẬT SẢN PHẨM - ADMIN
// ============================================

app.put("/api/products/:id", verifyToken, verifyAdmin, (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "ID sản phẩm không hợp lệ!");
        }

        const product = normalizeProduct(req.body);

        if (!product.name || !validPrice(product.price)) {
            return sendError(res, 400, "Tên hoặc giá sản phẩm không hợp lệ!");
        }

        if (
            !Number.isInteger(product.stock) ||
            product.stock < 0 ||
            !validPrice(product.original_price)
        ) {
            return sendError(res, 400, "Số lượng hoặc giá gốc không hợp lệ!");
        }

        const result = db.prepare(`
            UPDATE products
            SET
                name = ?,
                price = ?,
                image = ?,
                description = ?,
                category = ?,
                stock = ?,
                original_price = ?,
                featured = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            product.name,
            product.price,
            product.image,
            product.description,
            product.category,
            product.stock,
            product.original_price,
            product.featured,
            req.params.id
        );

        if (!result.changes) {
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

app.delete("/api/products/:id", verifyToken, verifyAdmin, (req, res) => {
    if (!validId(req.params.id)) {
        return sendError(res, 400, "ID sản phẩm không hợp lệ!");
    }

    const product = db.prepare(
        "SELECT id FROM products WHERE id = ?"
    ).get(req.params.id);

    if (!product) {
        return sendError(res, 404, "Không tìm thấy sản phẩm!");
    }

    // Không xóa sản phẩm đã xuất hiện trong đơn hàng cũ
    const usedInOrder = db.prepare(`
        SELECT id FROM order_items
        WHERE product_id = ?
        LIMIT 1
    `).get(req.params.id);

    if (usedInOrder) {
        return sendError(
            res,
            409,
            "Sản phẩm đã có trong đơn hàng. Hãy ngừng kinh doanh thay vì xóa."
        );
    }

    db.prepare(
        "DELETE FROM products WHERE id = ?"
    ).run(req.params.id);

    res.json({
        success: true,
        message: "Đã xóa sản phẩm!"
    });
});

// ============================================
// TẠO ĐƠN HÀNG
// ============================================

app.post("/api/orders", verifyToken, (req, res) => {
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
            return sendError(res, 400, "Vui lòng nhập đầy đủ thông tin nhận hàng!");
        }

        if (!/^\d{10,11}$/.test(customerPhone)) {
            return sendError(res, 400, "Số điện thoại không hợp lệ!");
        }

        if (!["COD", "BANK"].includes(payment)) {
            return sendError(res, 400, "Phương thức thanh toán không hợp lệ!");
        }

        if (!Array.isArray(products) || products.length === 0) {
            return sendError(res, 400, "Giỏ hàng đang trống!");
        }

        if (products.length > 50) {
            return sendError(res, 400, "Giỏ hàng có quá nhiều sản phẩm!");
        }

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
                return sendError(res, 400, "Thông tin sản phẩm trong giỏ hàng không hợp lệ!");
            }

            const product = db.prepare(
                "SELECT * FROM products WHERE id = ?"
            ).get(productId);

            if (!product) {
                return sendError(res, 404, "Có sản phẩm không còn tồn tại!");
            }

            if (Number(product.stock) < quantity) {
                return sendError(
                    res,
                    400,
                    `Sản phẩm ${product.name} không đủ số lượng trong kho!`
                );
            }

            orderProducts.push({
                product,
                quantity
            });

            total += Number(product.price) * quantity;
        }

        const createOrder = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO orders (
                    user_id,
                    fullname,
                    phone,
                    address,
                    payment,
                    total,
                    status,
                    payment_status,
                    note
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
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
            );

            const orderId = Number(result.lastInsertRowid);

            const insertItem = db.prepare(`
                INSERT INTO order_items (
                    order_id,
                    product_id,
                    product_name,
                    price,
                    quantity
                )
                VALUES (?, ?, ?, ?, ?)
            `);

            const updateStock = db.prepare(`
                UPDATE products
                SET stock = stock - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND stock >= ?
            `);

            for (const item of orderProducts) {
                insertItem.run(
                    orderId,
                    item.product.id,
                    item.product.name,
                    item.product.price,
                    item.quantity
                );

                const stockResult = updateStock.run(
                    item.quantity,
                    item.product.id,
                    item.quantity
                );

                if (!stockResult.changes) {
                    throw new Error(
                        `Sản phẩm ${item.product.name} vừa hết hàng.`
                    );
                }
            }

            return orderId;
        });

        const orderId = createOrder();

        res.status(201).json({
            success: true,
            message: "Đặt hàng thành công!",
            orderId,
            total
        });
    } catch (error) {
        console.error("CREATE ORDER ERROR:", error);
        sendError(
            res,
            500,
            error.message || "Không thể tạo đơn hàng!"
        );
    }
});

// ============================================
// BÁO ĐÃ CHUYỂN KHOẢN
// ============================================

app.post(
    "/api/orders/:id/report-transfer",
    verifyToken,
    (req, res) => {
        try {
            if (!validId(req.params.id)) {
                return sendError(res, 400, "Mã đơn hàng không hợp lệ!");
            }

            const order = db.prepare(`
                SELECT * FROM orders
                WHERE id = ? AND user_id = ?
            `).get(req.params.id, req.user.id);

            if (!order) {
                return sendError(res, 404, "Không tìm thấy đơn hàng!");
            }

            if (order.payment !== "BANK") {
                return sendError(res, 400, "Đơn hàng không sử dụng chuyển khoản!");
            }

            if (order.payment_status === "Đã thanh toán") {
                return sendError(res, 400, "Đơn hàng đã được xác nhận thanh toán!");
            }

            db.prepare(`
                UPDATE orders
                SET payment_status = ?,
                    transfer_reported_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run("Chờ kiểm tra", order.id);

            res.json({
                success: true,
                message: "Đã gửi thông báo chuyển khoản. Cửa hàng sẽ kiểm tra!"
            });
        } catch (error) {
            console.error("TRANSFER ERROR:", error);
            sendError(res, 500, "Không thể gửi thông báo chuyển khoản!");
        }
    }
);

// ============================================
// LỊCH SỬ ĐƠN HÀNG CỦA KHÁCH
// ============================================

app.get("/api/my-orders", verifyToken, (req, res) => {
    try {
        const orders = db.prepare(`
            SELECT *
            FROM orders
            WHERE user_id = ?
            ORDER BY id DESC
        `).all(req.user.id);

        const getItems = db.prepare(`
            SELECT *
            FROM order_items
            WHERE order_id = ?
        `);

        const result = orders.map(order => ({
            ...order,
            products: getItems.all(order.id)
        }));

        res.json(result);
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
    (req, res) => {
        try {
            const orders = db.prepare(`
                SELECT
                    orders.*,
                    users.email AS email
                FROM orders
                LEFT JOIN users ON orders.user_id = users.id
                ORDER BY orders.id DESC
            `).all();

            const getItems = db.prepare(`
                SELECT *
                FROM order_items
                WHERE order_id = ?
            `);

            const result = orders.map(order => ({
                ...order,
                products: getItems.all(order.id)
            }));

            res.json(result);
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
    (req, res) => {
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
            return sendError(res, 400, "Trạng thái đơn hàng không hợp lệ!");
        }

        const order = db.prepare(
            "SELECT * FROM orders WHERE id = ?"
        ).get(req.params.id);

        if (!order) {
            return sendError(res, 404, "Không tìm thấy đơn hàng!");
        }

        if (order.status === "Đã hủy" && status !== "Đã hủy") {
            return sendError(res, 400, "Đơn hàng đã hủy không thể khôi phục!");
        }

        if (status === "Đã hủy" && order.status !== "Đã hủy") {
            const cancelOrder = db.transaction(() => {
                const items = db.prepare(`
                    SELECT product_id, quantity
                    FROM order_items
                    WHERE order_id = ?
                `).all(order.id);

                const restoreStock = db.prepare(`
                    UPDATE products
                    SET stock = stock + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `);

                for (const item of items) {
                    if (item.product_id) {
                        restoreStock.run(
                            item.quantity,
                            item.product_id
                        );
                    }
                }

                db.prepare(`
                    UPDATE orders
                    SET status = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(status, order.id);
            });

            cancelOrder();
        } else {
            db.prepare(`
                UPDATE orders
                SET status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(status, order.id);
        }

        res.json({
            success: true,
            message: "Đã cập nhật trạng thái đơn hàng!"
        });
    }
);

// ============================================
// CẬP NHẬT TRẠNG THÁI THANH TOÁN - ADMIN
// ============================================

app.put(
    "/api/admin/orders/:id/payment-status",
    verifyToken,
    verifyAdmin,
    (req, res) => {
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
            return sendError(res, 400, "Trạng thái thanh toán không hợp lệ!");
        }

        const result = db.prepare(`
            UPDATE orders
            SET payment_status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, req.params.id);

        if (!result.changes) {
            return sendError(res, 404, "Không tìm thấy đơn hàng!");
        }

        res.json({
            success: true,
            message: "Đã cập nhật thanh toán!"
        });
    }
);

// ============================================
// THỐNG KÊ ADMIN
// ============================================

app.get(
    "/api/admin/statistics",
    verifyToken,
    verifyAdmin,
    (req, res) => {
        try {
            const products = db.prepare(`
                SELECT COUNT(*) AS total,
                       COALESCE(SUM(stock), 0) AS stock
                FROM products
            `).get();

            const users = db.prepare(`
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'user'
            `).get();

            const orders = db.prepare(`
                SELECT
                    COUNT(*) AS total,
                    COALESCE(SUM(
                        CASE
                            WHEN status = 'Đã giao hàng'
                            AND (
                                payment = 'COD'
                                OR payment_status = 'Đã thanh toán'
                            )
                            THEN total
                            ELSE 0
                        END
                    ), 0) AS revenue
                FROM orders
            `).get();

            res.json({
                success: true,
                products,
                users,
                orders
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

app.get("/api/products/:id/reviews", (req, res) => {
    if (!validId(req.params.id)) {
        return sendError(res, 400, "ID sản phẩm không hợp lệ!");
    }

    const reviews = db.prepare(`
        SELECT
            reviews.id,
            reviews.product_id,
            reviews.rating,
            reviews.comment,
            reviews.created_at,
            users.name AS user_name
        FROM reviews
        JOIN users ON reviews.user_id = users.id
        WHERE reviews.product_id = ?
        ORDER BY reviews.id DESC
    `).all(req.params.id);

    res.json(reviews);
});

// ============================================
// THÊM ĐÁNH GIÁ - KHÁCH ĐÃ MUA SẢN PHẨM
// ============================================

app.post("/api/products/:id/reviews", verifyToken, (req, res) => {
    try {
        const productId = Number(req.params.id);
        const rating = Number(req.body.rating);
        const comment = String(req.body.comment || "").trim();

        if (!validId(productId)) {
            return sendError(res, 400, "ID sản phẩm không hợp lệ!");
        }

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return sendError(res, 400, "Đánh giá phải từ 1 đến 5 sao!");
        }

        if (!comment || comment.length > 1000) {
            return sendError(res, 400, "Nội dung đánh giá không hợp lệ!");
        }

        const product = db.prepare(
            "SELECT id FROM products WHERE id = ?"
        ).get(productId);

        if (!product) {
            return sendError(res, 404, "Không tìm thấy sản phẩm!");
        }

        const purchase = db.prepare(`
            SELECT orders.id
            FROM orders
            JOIN order_items ON orders.id = order_items.order_id
            WHERE orders.user_id = ?
            AND orders.status = 'Đã giao hàng'
            AND order_items.product_id = ?
            LIMIT 1
        `).get(req.user.id, productId);

        if (!purchase) {
            return sendError(
                res,
                403,
                "Bạn cần mua và nhận sản phẩm trước khi đánh giá!"
            );
        }

        const alreadyReviewed = db.prepare(`
            SELECT id FROM reviews
            WHERE user_id = ? AND product_id = ?
            LIMIT 1
        `).get(req.user.id, productId);

        if (alreadyReviewed) {
            return sendError(res, 409, "Bạn đã đánh giá sản phẩm này!");
        }

        db.prepare(`
            INSERT INTO reviews (
                product_id, user_id, order_id, rating, comment
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            productId,
            req.user.id,
            purchase.id,
            rating,
            comment
        );

        res.status(201).json({
            success: true,
            message: "Cảm ơn bạn đã đánh giá sản phẩm!"
        });
    } catch (error) {
        console.error("REVIEW ERROR:", error);
        sendError(res, 500, "Không thể gửi đánh giá!");
    }
});

// ============================================
// XỬ LÝ LỖI
// ============================================

app.use((req, res) => {
    sendError(res, 404, "Không tìm thấy đường dẫn yêu cầu!");
});

app.use((error, req, res, next) => {
    console.error("SERVER ERROR:", error);

    if (res.headersSent) {
        return next(error);
    }

    sendError(res, 500, "Máy chủ gặp lỗi. Vui lòng thử lại!");
});

// ============================================
// KHỞI ĐỘNG SERVER
// ============================================

app.listen(PORT, () => {
    console.log("=================================");
    console.log("HẢI APPLE STORE");
    console.log(`Server: http://localhost:${PORT}`);
    console.log("Backend đang hoạt động!");
    console.log("=================================");
});
