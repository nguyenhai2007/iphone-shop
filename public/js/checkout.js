
// ==========================================
// HẢI APPLE STORE - CHECKOUT
// Đồng bộ với Express + SQLite Backend
// ==========================================

const API_URL = "/api";

let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentOrderId = null;

function formatPrice(price) {
    return Number(price).toLocaleString("vi-VN") + "đ";
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

function getTotal() {
    return cart.reduce((total, item) => {
        return total + Number(item.price) * Number(item.quantity);
    }, 0);
}

function updateCartCount() {
    const element = document.getElementById("cart-count");
    if (!element) return;

    element.textContent = cart.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
    );
}

// ==========================================
// HIỂN THỊ GIỎ HÀNG
// ==========================================

function showCheckout() {
    const container = document.getElementById("checkout-items");
    const totalElement = document.getElementById("checkout-total");
    const subtotalElement = document.getElementById("checkout-subtotal");

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <p>Giỏ hàng đang trống.</p>
            <a href="index.html">Quay lại mua sắm</a>
        `;

        const button = document.querySelector(
            '#checkoutForm button[type="submit"]'
        );

        if (button) button.disabled = true;
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <div>
                <strong>${escapeHTML(item.name)}</strong>
                <small>Số lượng: ${Number(item.quantity)}</small>
            </div>
            <strong>
                ${formatPrice(Number(item.price) * Number(item.quantity))}
            </strong>
        </div>
    `).join("");

    const total = getTotal();

    if (totalElement) {
        totalElement.textContent = formatPrice(total);
    }

    if (subtotalElement) {
        subtotalElement.textContent = formatPrice(total);
    }

    updateCartCount();
}

// ==========================================
// PHƯƠNG THỨC THANH TOÁN
// ==========================================

function handlePaymentMethod() {
    const bankPayment = document.getElementById("bank-payment");
    const selected = document.querySelector(
        'input[name="payment"]:checked'
    );

    if (!bankPayment || !selected) return;

    bankPayment.hidden = selected.value !== "BANK";
}

// ==========================================
// ĐẶT HÀNG
// ==========================================

async function placeOrder(event) {
    event.preventDefault();

    if (!getToken()) {
        alert("Vui lòng đăng nhập trước khi đặt hàng!");
        window.location.href = "login.html";
        return;
    }

    if (cart.length === 0) {
        alert("Giỏ hàng đang trống!");
        return;
    }

    const fullname = document.getElementById("fullname").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const address = document.getElementById("address").value.trim();
    const note = document.getElementById("note").value.trim();

    const payment = document.querySelector(
        'input[name="payment"]:checked'
    )?.value;

    if (!fullname || !phone || !address) {
        alert("Vui lòng nhập đầy đủ thông tin nhận hàng!");
        return;
    }

    if (!/^\d{10,11}$/.test(phone)) {
        alert("Số điện thoại phải gồm 10 hoặc 11 chữ số!");
        return;
    }

    if (!["COD", "BANK"].includes(payment)) {
        alert("Vui lòng chọn phương thức thanh toán!");
        return;
    }

    const button = document.querySelector(
        '#checkoutForm button[type="submit"]'
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Đang xử lý...";
    }

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                fullname,
                phone,
                address,
                note,
                payment,
                products: cart.map(item => ({
                    id: item.id,
                    quantity: Number(item.quantity)
                }))
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Không thể đặt hàng!");
        }

        // Backend trả trực tiếp orderId
        currentOrderId = result.orderId;

        if (!currentOrderId) {
            throw new Error("Máy chủ không trả về mã đơn hàng!");
        }

        if (payment === "BANK") {
            showBankInformation();

            alert(
                "Đặt hàng thành công! Vui lòng chuyển khoản theo thông tin hiển thị."
            );
        } else {
            localStorage.removeItem("cart");

            alert("Đặt hàng thành công!");

            window.location.href = "orders.html";
        }

    } catch (error) {
        alert(error.message || "Có lỗi xảy ra khi đặt hàng!");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Đặt hàng ngay";
        }
    }
}

// ==========================================
// HIỂN THỊ THÔNG TIN CHUYỂN KHOẢN
// ==========================================

function showBankInformation() {
    const bankPayment = document.getElementById("bank-payment");

    if (bankPayment) {
        bankPayment.hidden = false;
    }

    const amount = document.getElementById("bank-amount");
    const content = document.getElementById("bank-content");
    const orderId = document.getElementById("order-id");
    const button = document.getElementById("confirm-transfer");

    if (amount) {
        amount.textContent = formatPrice(getTotal());
    }

    if (content) {
        content.textContent = `HAI APPLE ${currentOrderId}`;
    }

    if (orderId) {
        orderId.textContent = currentOrderId;
    }

    if (button) {
        button.dataset.orderId = currentOrderId;
        button.disabled = false;
    }
}

// ==========================================
// BÁO ĐÃ CHUYỂN KHOẢN
// ==========================================

async function confirmTransfer() {
    if (!currentOrderId || !getToken()) {
        alert("Không tìm thấy mã đơn hàng hoặc phiên đăng nhập!");
        return;
    }

    const button = document.getElementById("confirm-transfer");

    if (button) {
        button.disabled = true;
        button.textContent = "Đang gửi...";
    }

    try {
        const response = await fetch(
            `${API_URL}/orders/${encodeURIComponent(currentOrderId)}/report-transfer`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getToken()}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Không thể gửi xác nhận!");
        }

        localStorage.removeItem("cart");

        alert(
            "Đã gửi thông báo chuyển khoản. Cửa hàng sẽ kiểm tra giao dịch trước khi xác nhận thanh toán."
        );

        window.location.href = "orders.html";

    } catch (error) {
        alert(error.message || "Có lỗi xảy ra!");

        if (button) {
            button.disabled = false;
            button.textContent = "Tôi đã chuyển khoản";
        }
    }
}

// ==========================================
// KHỞI CHẠY
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    showCheckout();

    document.querySelectorAll('input[name="payment"]').forEach(input => {
        input.addEventListener("change", handlePaymentMethod);
    });

    document.getElementById("checkoutForm")
        ?.addEventListener("submit", placeOrder);

    document.getElementById("confirm-transfer")
        ?.addEventListener("click", confirmTransfer);

    handlePaymentMethod();
});
