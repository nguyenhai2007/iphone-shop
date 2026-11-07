
// ==========================================
// HẢI APPLE STORE - QUẢN LÝ GIỎ HÀNG
// ==========================================

let cart = JSON.parse(localStorage.getItem("cart")) || [];

function formatPrice(price) {
    return Number(price).toLocaleString("vi-VN") + "đ";
}

// Lưu giỏ hàng
function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

// Cập nhật số lượng trên header
function updateCartCount() {
    const countElement = document.getElementById("cart-count");

    if (!countElement) return;

    const count = cart.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
    );

    countElement.textContent = count;
}

// Hiển thị giỏ hàng
function renderCart() {
    const container = document.getElementById("cart-items");
    const emptyCart = document.getElementById("empty-cart");
    const subtotalElement = document.getElementById("subtotal-price");
    const totalElement = document.getElementById("total-price");
    const checkoutButton = document.getElementById("checkout-button");

    if (!container) return;

    updateCartCount();

    if (cart.length === 0) {
        container.innerHTML = "";
        emptyCart.hidden = false;

        if (subtotalElement) subtotalElement.textContent = "0đ";
        if (totalElement) totalElement.textContent = "0đ";
        if (checkoutButton) {
            checkoutButton.style.pointerEvents = "none";
            checkoutButton.style.opacity = "0.5";
        }

        return;
    }

    emptyCart.hidden = true;

    let subtotal = 0;

    container.innerHTML = cart.map((item, index) => {
        const price = Number(item.price) || 0;
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const itemTotal = price * quantity;

        subtotal += itemTotal;

        const image = escapeHTML(item.image || "images/banner-iphone.png");
        const name = escapeHTML(item.name || "Sản phẩm iPhone");

        return `
            <div class="cart-item">

                <div class="cart-item-image">
                    <img src="${image}"
                         alt="${name}"
                         onerror="this.src='images/banner-iphone.png'">
                </div>

                <div class="cart-item-info">
                    <h3>${name}</h3>

                    <p class="cart-item-price">
                        ${formatPrice(price)}
                    </p>

                    <div class="cart-quantity">
                        <button onclick="changeQuantity(${index}, -1)"
                                aria-label="Giảm số lượng">−</button>

                        <span>${quantity}</span>

                        <button onclick="changeQuantity(${index}, 1)"
                                aria-label="Tăng số lượng">+</button>
                    </div>
                </div>

                <div class="cart-item-actions">
                    <strong>${formatPrice(itemTotal)}</strong>

                    <button class="remove-cart-item"
                            onclick="removeItem(${index})">
                        Xóa
                    </button>
                </div>

            </div>
        `;
    }).join("");

    if (subtotalElement) {
        subtotalElement.textContent = formatPrice(subtotal);
    }

    if (totalElement) {
        totalElement.textContent = formatPrice(subtotal);
    }

    if (checkoutButton) {
        checkoutButton.style.pointerEvents = "auto";
        checkoutButton.style.opacity = "1";
    }
}

// Chống chèn HTML không an toàn
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// Thay đổi số lượng
function changeQuantity(index, amount) {
    if (!cart[index]) return;

    const newQuantity = Number(cart[index].quantity) + amount;

    if (newQuantity < 1) return;

    cart[index].quantity = newQuantity;

    saveCart();
    renderCart();
}

// Xóa sản phẩm
function removeItem(index) {
    if (!cart[index]) return;

    cart.splice(index, 1);

    saveCart();
    renderCart();
}

// Khởi chạy
document.addEventListener("DOMContentLoaded", () => {
    renderCart();
});
