
// ==========================================
// HẢI APPLE STORE - ADMIN QUẢN LÝ ĐƠN HÀNG
// ==========================================

const API_URL = "/api";

let orders = [];
let revenueChartInstance = null;
const updatingOrders = new Set();

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
        localStorage.getItem("authToken") || "";
}

function formatDate(date) {
    if (!date) return "Chưa cập nhật";

    const parsedDate = new Date(
        String(date).replace(" ", "T")
    );

    return Number.isNaN(parsedDate.getTime())
        ? date
        : parsedDate.toLocaleString("vi-VN");
}

// ==========================================
// GỌI API
// ==========================================

async function apiRequest(url, options = {}) {
    const token = getToken();

    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? {
                Authorization: `Bearer ${token}`
            } : {}),
            ...options.headers
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.message || "Không thể thực hiện yêu cầu!"
        );
    }

    return result;
}

// ==========================================
// KIỂM TRA ADMIN
// ==========================================

async function checkAdmin() {
    if (!getToken()) {
        window.location.href = "login.html";
        return false;
    }

    try {
        const result = await apiRequest("/me");
        const user = result.user || result;

        if (user.role !== "admin") {
            alert("Bạn không có quyền quản trị!");
            window.location.href = "index.html";
            return false;
        }

        return true;

    } catch (error) {
        alert("Phiên đăng nhập đã hết hạn!");

        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");

        window.location.href = "login.html";
        return false;
    }
}

// ==========================================
// TRẠNG THÁI
// ==========================================

const ORDER_STATUSES = [
    "Đang xử lý",
    "Đã xác nhận",
    "Đang giao hàng",
    "Đã giao hàng",
    "Đã hủy"
];

const PAYMENT_STATUSES = [
    "Chưa thanh toán",
    "Chờ chuyển khoản",
    "Chờ kiểm tra",
    "Đã thanh toán"
];

function getPaymentLabel(status) {
    return status || "Chưa cập nhật";
}

// ==========================================
// TẢI ĐƠN HÀNG
// ==========================================

async function loadOrders() {
    const container = document.getElementById("adminOrders");

    if (!container) return;

    container.innerHTML = `
        <p class="loading-products">Đang tải đơn hàng...</p>
    `;

    try {
        const result = await apiRequest("/admin/orders");

        orders = Array.isArray(result)
            ? result
            : result.orders || result.data || [];

        displayStatistics();
        displayRevenueChart();
        displayOrders();

    } catch (error) {
        container.innerHTML = `
            <div class="empty-orders">
                <h3>Không thể tải đơn hàng</h3>
                <p>${escapeHTML(error.message)}</p>
                <button class="btn-secondary" onclick="loadOrders()">
                    Thử lại
                </button>
            </div>
        `;
    }
}

// ==========================================
// THỐNG KÊ
// ==========================================

function isRevenueOrder(order) {
    return (
        order.status === "Đã giao hàng" &&
        (
            order.payment === "COD" ||
            order.payment_status === "Đã thanh toán"
        )
    );
}

function displayStatistics() {
    const container = document.getElementById("orderStatistics");

    if (!container) return;

    const totalOrders = orders.length;

    const pendingOrders = orders.filter(
        order => order.status === "Đang xử lý"
    ).length;

    const completedOrders = orders.filter(
        order => order.status === "Đã giao hàng"
    ).length;

    const revenue = orders
        .filter(isRevenueOrder)
        .reduce(
            (sum, order) => sum + Number(order.total || 0),
            0
        );

    container.innerHTML = `
        <div class="admin-stat-card">
            <span>Tổng đơn hàng</span>
            <strong>${totalOrders}</strong>
        </div>

        <div class="admin-stat-card">
            <span>Đang xử lý</span>
            <strong>${pendingOrders}</strong>
        </div>

        <div class="admin-stat-card">
            <span>Đã giao hàng</span>
            <strong>${completedOrders}</strong>
        </div>

        <div class="admin-stat-card">
            <span>Doanh thu ghi nhận</span>
            <strong>${formatPrice(revenue)}</strong>
        </div>
    `;
}

// ==========================================
// BIỂU ĐỒ DOANH THU
// ==========================================

function displayRevenueChart() {
    const canvas = document.getElementById("revenueChart");

    if (!canvas || typeof Chart === "undefined") return;

    const dailyRevenue = {};

    orders.forEach(order => {
        if (!isRevenueOrder(order)) return;

        const date = order.created_at
            ? order.created_at.substring(0, 10)
            : "Không rõ ngày";

        dailyRevenue[date] =
            (dailyRevenue[date] || 0) +
            Number(order.total || 0);
    });

    const sortedDates = Object.keys(dailyRevenue).sort();

    const labels = sortedDates.map(date => {
        if (date === "Không rõ ngày") return date;

        const [year, month, day] = date.split("-");

        return `${day}/${month}/${year}`;
    });

    const values = sortedDates.map(
        date => dailyRevenue[date]
    );

    if (revenueChartInstance) {
        revenueChartInstance.destroy();
    }

    revenueChartInstance = new Chart(canvas, {
        type: "line",

        data: {
            labels,

            datasets: [{
                label: "Doanh thu",
                data: values,
                borderColor: "#0071e3",
                backgroundColor: "rgba(0, 113, 227, 0.12)",
                borderWidth: 3,
                fill: true,
                tension: 0.35
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: true
                },

                tooltip: {
                    callbacks: {
                        label: context =>
                            "Doanh thu: " +
                            formatPrice(context.parsed.y)
                    }
                }
            },

            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatPrice(value)
                    }
                }
            }
        }
    });
}

// ==========================================
// TẠO OPTION
// ==========================================

function createStatusOptions(status, statuses) {
    return statuses.map(item => `
        <option
            value="${escapeHTML(item)}"
            ${status === item ? "selected" : ""}
        >
            ${escapeHTML(item)}
        </option>
    `).join("");
}

// ==========================================
// TÌM KIẾM VÀ LỌC
// ==========================================

function displayOrders() {
    const container = document.getElementById("adminOrders");

    if (!container) return;

    const keyword = (
        document.getElementById("orderSearch")?.value || ""
    ).trim().toLowerCase();

    const selectedStatus =
        document.getElementById("statusFilter")?.value || "";

    const filteredOrders = orders.filter(order => {
        const searchableText = [
            order.id,
            order.phone,
            order.fullname
        ].join(" ").toLowerCase();

        const matchesKeyword =
            searchableText.includes(keyword);

        const matchesStatus =
            !selectedStatus ||
            order.status === selectedStatus;

        return matchesKeyword && matchesStatus;
    });

    if (!filteredOrders.length) {
        container.innerHTML = `
            <div class="empty-orders">
                <h3>Không tìm thấy đơn hàng</h3>
                <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredOrders.map(order => {
        const id = Number(order.id);
        const products = Array.isArray(order.products)
            ? order.products
            : [];

        return `
            <article class="admin-order-card">

                <div class="admin-order-heading">
                    <div>
                        <span>MÃ ĐƠN HÀNG</span>
                        <h3>#${escapeHTML(order.id)}</h3>
                    </div>

                    <strong>${formatPrice(order.total)}</strong>
                </div>

                <div class="admin-order-info">

                    <p>
                        <strong>Khách hàng:</strong>
                        ${escapeHTML(order.fullname)}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        ${escapeHTML(order.email)}
                    </p>

                    <p>
                        <strong>Điện thoại:</strong>
                        ${escapeHTML(order.phone)}
                    </p>

                    <p>
                        <strong>Địa chỉ:</strong>
                        ${escapeHTML(order.address)}
                    </p>

                    <p>
                        <strong>Thanh toán:</strong>
                        ${escapeHTML(order.payment)}
                    </p>

                    <p>
                        <strong>Trạng thái thanh toán:</strong>
                        ${escapeHTML(getPaymentLabel(order.payment_status))}
                    </p>

                    <p>
                        <strong>Ngày đặt:</strong>
                        ${escapeHTML(formatDate(order.created_at))}
                    </p>

                </div>

                <div class="admin-order-products">
                    <strong>Sản phẩm trong đơn</strong>

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

                <div class="admin-order-controls">

                    <div class="form-group">
                        <label for="status-${id}">
                            Trạng thái đơn hàng
                        </label>

                        <select id="status-${id}">
                            ${createStatusOptions(
                                order.status,
                                ORDER_STATUSES
                            )}
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="payment-${id}">
                            Trạng thái thanh toán
                        </label>

                        <select id="payment-${id}">
                            ${createStatusOptions(
                                order.payment_status,
                                PAYMENT_STATUSES
                            )}
                        </select>
                    </div>

                    <button
                        class="btn-primary"
                        id="save-order-${id}"
                        onclick="updateOrder(${id})"
                    >
                        Lưu thay đổi
                    </button>

                </div>

            </article>
        `;
    }).join("");
}

// ==========================================
// CẬP NHẬT ĐƠN HÀNG
// ==========================================

async function updateOrder(id) {
    if (updatingOrders.has(id)) return;

    const statusElement = document.getElementById(`status-${id}`);
    const paymentElement = document.getElementById(`payment-${id}`);
    const saveButton = document.getElementById(`save-order-${id}`);

    if (!statusElement || !paymentElement) return;

    const order = orders.find(item => Number(item.id) === id);

    if (!order) {
        alert("Không tìm thấy đơn hàng!");
        return;
    }

    const status = statusElement.value;
    const paymentStatus = paymentElement.value;

    if (order.status === "Đã hủy" && status !== "Đã hủy") {
        alert("Đơn hàng đã hủy không thể khôi phục!");
        return;
    }

    if (
        status === order.status &&
        paymentStatus === order.payment_status
    ) {
        alert("Bạn chưa thay đổi thông tin đơn hàng!");
        return;
    }

    if (!confirm("Bạn muốn cập nhật đơn hàng này?")) return;

    updatingOrders.add(id);

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Đang lưu...";
    }

    try {
        if (status !== order.status) {
            await apiRequest(`/admin/orders/${id}/status`, {
                method: "PUT",
                body: JSON.stringify({ status })
            });
        }

        if (paymentStatus !== order.payment_status) {
            await apiRequest(`/admin/orders/${id}/payment-status`, {
                method: "PUT",
                body: JSON.stringify({
                    payment_status: paymentStatus
                })
            });
        }

        alert("Cập nhật đơn hàng thành công!");
        await loadOrders();

    } catch (error) {
        alert(error.message || "Không thể cập nhật đơn hàng!");
        await loadOrders();

    } finally {
        updatingOrders.delete(id);
    }
}

// ==========================================
// ĐĂNG XUẤT
// ==========================================

function logoutAdmin() {
    if (!confirm("Bạn có muốn đăng xuất?")) return;

    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    window.location.href = "login.html";
}

// ==========================================
// KHỞI CHẠY
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    const isAdmin = await checkAdmin();

    if (!isAdmin) return;

    document.getElementById("refreshOrders")
        ?.addEventListener("click", loadOrders);

    document.getElementById("orderSearch")
        ?.addEventListener("input", displayOrders);

    document.getElementById("statusFilter")
        ?.addEventListener("change", displayOrders);

    document.getElementById("logoutButton")
        ?.addEventListener("click", logoutAdmin);

    await loadOrders();
});
