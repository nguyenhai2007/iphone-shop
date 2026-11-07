
// ==========================================
// HẢI APPLE STORE - LỊCH SỬ ĐƠN HÀNG
// Đồng bộ Express + SQLite Backend
// ==========================================

const API_URL = "/api";

// ==========================================
// HÀM HỖ TRỢ
// ==========================================

function formatPrice(price) {
    return Number(price || 0).toLocaleString("vi-VN") + "đ";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getToken() {
    return localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        "";
}

// Định dạng ngày đặt hàng
function formatDate(date) {
    if (!date) return "Chưa cập nhật";

    const parsedDate = new Date(date.replace(" ", "T"));

    if (Number.isNaN(parsedDate.getTime())) {
        return date;
    }

    return parsedDate.toLocaleString("vi-VN");
}

// ==========================================
// TRẠNG THÁI ĐƠN HÀNG
// ==========================================

function getStatus(status) {
    const statuses = {
        "Đang xử lý": "Đang xử lý",
        "Đã xác nhận": "Đã xác nhận",
        "Đang giao hàng": "Đang giao hàng",
        "Đã giao hàng": "Đã giao hàng",
        "Đã hủy": "Đã hủy",

        pending: "Chờ xác nhận",
        confirmed: "Đã xác nhận",
        processing: "Đang xử lý",
        shipping: "Đang giao hàng",
        completed: "Đã giao hàng",
        cancelled: "Đã hủy"
    };

    return statuses[status] || status || "Chưa cập nhật";
}

// ==========================================
// TRẠNG THÁI THANH TOÁN
// ==========================================

function getPaymentStatus(status) {
    const statuses = {
        "Chưa thanh toán": "Chưa thanh toán",
        "Chờ chuyển khoản": "Chờ chuyển khoản",
        "Chờ kiểm tra": "Chờ cửa hàng kiểm tra",
        "Đã thanh toán": "Đã thanh toán",

        unpaid: "Chưa thanh toán",
        pending: "Chờ xác nhận thanh toán",
        paid: "Đã thanh toán",
        failed: "Thanh toán thất bại"
    };

    return statuses[status] || status || "Chưa cập nhật";
}

// ==========================================
// TẢI LỊCH SỬ ĐƠN HÀNG
// ==========================================

async function loadOrders() {
    const container = document.getElementById("ordersList");

    if (!container) return;

    const token = getToken();

    if (!token) {
        container.innerHTML = `
            <div class="empty-orders">
                <h3>Bạn chưa đăng nhập</h3>
                <p>Vui lòng đăng nhập để xem lịch sử đơn hàng.</p>
                <a href="login.html" class="btn-primary">
                    Đăng nhập ngay
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <p class="loading-products">Đang tải đơn hàng...</p>
    `;

    try {
        const response = await fetch(`${API_URL}/my-orders`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("authToken");
            }

            throw new Error(
                result.message || "Không thể tải đơn hàng!"
            );
        }

        // Backend hiện tại trả về trực tiếp một mảng
        const orders = Array.isArray(result)
            ? result
            : result.orders || result.data || [];

        displayOrders(orders);

    } catch (error) {
        container.innerHTML = `
            <div class="empty-orders">
                <h3>Không thể tải đơn hàng</h3>
                <p>${escapeHTML(error.message)}</p>

                <button
                    class="btn-secondary"
                    onclick="loadOrders()"
                >
                    Thử lại
                </button>
            </div>
        `;
    }
}

// ==========================================
// HIỂN THỊ DANH SÁCH ĐƠN HÀNG
// ==========================================

function displayOrders(orders) {
    const container = document.getElementById("ordersList");

    if (!container) return;

    if (!Array.isArray(orders) || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-orders">
                <div class="empty-cart-icon">📦</div>

                <h3>Bạn chưa có đơn hàng nào</h3>

                <p>
                    Hãy khám phá các sản phẩm tại Hải Apple Store.
                </p>

                <a href="index.html" class="btn-primary">
                    Mua sắm ngay
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => {
        const products = order.products || order.items || [];

        return `
            <article class="order-card">

                <div class="order-card-header">
                    <div>
                        <span class="order-label">
                            MÃ ĐƠN HÀNG
                        </span>

                        <h3>#${escapeHTML(order.id)}</h3>
                    </div>

                    <span class="order-status">
                        ${escapeHTML(getStatus(order.status))}
                    </span>
                </div>

                <div class="order-information">

                    <p>
                        <strong>Ngày đặt:</strong>
                        ${escapeHTML(formatDate(order.created_at))}
                    </p>

                    <p>
                        <strong>Người nhận:</strong>
                        ${escapeHTML(order.fullname || "")}
                    </p>

                    <p>
                        <strong>Điện thoại:</strong>
                        ${escapeHTML(order.phone || "")}
                    </p>

                    <p>
                        <strong>Địa chỉ:</strong>
                        ${escapeHTML(order.address || "")}
                    </p>

                    <p>
                        <strong>Phương thức thanh toán:</strong>
                        ${escapeHTML(order.payment || "")}
                    </p>

                    <p>
                        <strong>Trạng thái thanh toán:</strong>
                        ${escapeHTML(getPaymentStatus(order.payment_status))}
                    </p>

                    ${order.note ? `
                        <p>
                            <strong>Ghi chú:</strong>
                            ${escapeHTML(order.note)}
                        </p>
                    ` : ""}

                </div>

                <div class="order-products">
                    <h4>Sản phẩm</h4>

                    ${products.map(item => `
                        <div class="order-product-row">

                            <span>
                                ${escapeHTML(item.product_name || "Sản phẩm")}
                                × ${Number(item.quantity || 0)}
                            </span>

                            <strong>
                                ${formatPrice(
                                    Number(item.price || 0) *
                                    Number(item.quantity || 0)
                                )}
                            </strong>

                        </div>
                    `).join("")}
                </div>

                <div class="order-card-footer">
                    <span>Tổng thanh toán</span>

                    <strong>
                        ${formatPrice(order.total)}
                    </strong>
                </div>

            </article>
        `;
    }).join("");
}

// ==========================================
// KHỞI CHẠY
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    loadOrders();

    document.getElementById("refresh-orders")
        ?.addEventListener("click", loadOrders);
});
