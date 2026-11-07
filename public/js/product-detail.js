
// ==========================================
// HẢI APPLE STORE - CHI TIẾT SẢN PHẨM
// ==========================================

const API_URL = "/api";

let currentProduct = null;
let selectedQuantity = 1;

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

function getProductId() {
    return new URLSearchParams(window.location.search).get("id");
}

function getSafeImage(image) {
    try {
        const url = new URL(image, window.location.origin);

        if (
            url.protocol === "http:" ||
            url.protocol === "https:"
        ) {
            return escapeHTML(url.href);
        }
    } catch (error) {
        // Sử dụng ảnh dự phòng bên dưới
    }

    return "images/banner-iphone.png";
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
// GIỎ HÀNG
// ==========================================

function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem("cart"));
        return Array.isArray(cart) ? cart : [];
    } catch (error) {
        return [];
    }
}

function updateCartCount() {
    const cart = getCart();

    const count = cart.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
    );

    const element = document.getElementById("cart-count");

    if (element) {
        element.textContent = count;
    }
}

function addToCart() {
    if (!currentProduct) return;

    const stock = Number(currentProduct.stock || 0);

    if (stock <= 0) {
        alert("Sản phẩm hiện đã hết hàng!");
        return;
    }

    let cart = getCart();

    const existing = cart.find(
        item => Number(item.id) === Number(currentProduct.id)
    );

    const currentQuantity = existing
        ? Number(existing.quantity || 0)
        : 0;

    if (currentQuantity + selectedQuantity > stock) {
        alert(`Sản phẩm chỉ còn ${stock} chiếc trong kho!`);
        return;
    }

    if (existing) {
        existing.quantity += selectedQuantity;
    } else {
        cart.push({
            id: currentProduct.id,
            name: currentProduct.name,
            price: currentProduct.price,
            image: currentProduct.image,
            quantity: selectedQuantity
        });
    }

    localStorage.setItem("cart", JSON.stringify(cart));

    updateCartCount();

    alert("Đã thêm sản phẩm vào giỏ hàng!");
}

// ==========================================
// CHỌN SỐ LƯỢNG
// ==========================================

function changeQuantity(amount) {
    if (!currentProduct) return;

    const stock = Number(currentProduct.stock || 0);

    selectedQuantity += amount;

    if (selectedQuantity < 1) {
        selectedQuantity = 1;
    }

    if (selectedQuantity > stock) {
        selectedQuantity = stock;
    }

    const element = document.getElementById("quantity-value");

    if (element) {
        element.textContent = selectedQuantity;
    }
}

// ==========================================
// HIỂN THỊ CHI TIẾT SẢN PHẨM
// ==========================================

function displayProduct(product) {
    const container = document.getElementById("product-detail");
    const description = document.getElementById("product-description");

    if (!container) return;

    currentProduct = product;

    const price = Number(product.price || 0);
    const originalPrice = Number(product.original_price || 0);
    const stock = Number(product.stock || 0);

    const hasDiscount =
        originalPrice > price && originalPrice > 0;

    container.innerHTML = `
        <div class="product-detail-layout">

            <div class="product-detail-image">
                <img
                    src="${getSafeImage(product.image)}"
                    alt="${escapeHTML(product.name)}"
                    onerror="this.onerror=null;this.src='images/banner-iphone.png'"
                >
            </div>

            <div class="product-detail-info">

                <p class="section-label">HẢI APPLE STORE</p>

                <h1>${escapeHTML(product.name)}</h1>

                <div class="product-detail-price">
                    <strong>${formatPrice(price)}</strong>

                    ${
                        hasDiscount
                            ? `<del>${formatPrice(originalPrice)}</del>`
                            : ""
                    }
                </div>

                <p class="product-detail-description">
                    ${escapeHTML(
                        product.description ||
                        "Sản phẩm chính hãng, chất lượng cao."
                    )}
                </p>

                <div class="product-detail-meta">
                    <p>
                        <strong>Danh mục:</strong>
                        ${escapeHTML(product.category || "iPhone")}
                    </p>

                    <p>
                        <strong>Tình trạng:</strong>
                        ${
                            stock > 0
                                ? `Còn ${stock} sản phẩm`
                                : "Tạm hết hàng"
                        }
                    </p>

                    <p>
                        <strong>Bảo hành:</strong>
                        Theo chính sách của cửa hàng
                    </p>
                </div>

                <div class="quantity-selector">
                    <span>Số lượng:</span>

                    <div class="quantity-controls">
                        <button
                            type="button"
                            onclick="changeQuantity(-1)"
                            ${stock <= 0 ? "disabled" : ""}
                        >−</button>

                        <strong id="quantity-value">1</strong>

                        <button
                            type="button"
                            onclick="changeQuantity(1)"
                            ${stock <= 0 ? "disabled" : ""}
                        >+</button>
                    </div>
                </div>

                <div class="product-detail-actions">
                    <button
                        class="btn-primary"
                        onclick="addToCart()"
                        ${stock <= 0 ? "disabled" : ""}
                    >
                        Thêm vào giỏ hàng
                    </button>

                    <a href="cart.html" class="btn-secondary">
                        Xem giỏ hàng
                    </a>
                </div>

                <div class="product-guarantee">
                    <p>✓ Kiểm tra sản phẩm trước khi nhận</p>
                    <p>✓ Hỗ trợ tư vấn khách hàng</p>
                    <p>✓ Chính sách bảo hành theo cửa hàng</p>
                </div>

            </div>

        </div>
    `;

    if (description) {
        description.innerHTML = `
            <p>
                ${escapeHTML(
                    product.description ||
                    "Thông tin chi tiết sản phẩm đang được cập nhật."
                )}
            </p>
        `;
    }

    document.title =
        `${product.name} | Hải Apple Store`;
}

// ==========================================
// TẢI SẢN PHẨM
// ==========================================

async function loadProduct() {
    const container = document.getElementById("product-detail");
    const id = getProductId();

    if (!id || !/^\d+$/.test(id)) {
        container.innerHTML = `
            <div class="empty-orders">
                <h3>Không tìm thấy sản phẩm</h3>
                <a href="index.html">Quay lại trang chủ</a>
            </div>
        `;
        return;
    }

    try {
        const result = await apiRequest(`/products/${id}`);

        const product = result.product || result;

        if (!product || !product.id) {
            throw new Error("Sản phẩm không tồn tại!");
        }

        displayProduct(product);

        await loadReviews(id);

    } catch (error) {
        container.innerHTML = `
            <div class="empty-orders">
                <h3>Không thể tải sản phẩm</h3>
                <p>${escapeHTML(error.message)}</p>
                <a href="index.html">Quay lại trang chủ</a>
            </div>
        `;
    }
}

// ==========================================
// TẢI ĐÁNH GIÁ
// ==========================================

async function loadReviews(productId) {
    const container = document.getElementById("product-reviews");

    if (!container) return;

    try {
        const result = await apiRequest(
            `/products/${productId}/reviews`
        );

        const reviews = Array.isArray(result)
            ? result
            : result.reviews || result.data || [];

        if (!reviews.length) {
            container.innerHTML = `
                <p>Chưa có đánh giá cho sản phẩm này.</p>
            `;
        } else {
            container.innerHTML = reviews.map(review => `
                <article class="product-review-card">

                    <strong>
                        ${escapeHTML(review.name || review.fullname || "Khách hàng")}
                    </strong>

                    <p class="review-stars">
                        ${"★".repeat(
                            Math.max(0, Math.min(5, Number(review.rating || 0)))
                        )}
                    </p>

                    <p>${escapeHTML(
                        review.comment || review.content || ""
                    )}</p>

                </article>
            `).join("");
        }

    } catch (error) {
        container.innerHTML = `
            <p>Chưa thể tải đánh giá sản phẩm.</p>
        `;
    }

    const formContainer = document.getElementById(
        "review-form-container"
    );

    if (formContainer) {
        formContainer.innerHTML = `
            <p>
                Bạn đã mua và nhận sản phẩm?
                Hãy đăng nhập để gửi đánh giá.
            </p>

            <a href="login.html" class="btn-secondary">
                Đăng nhập
            </a>
        `;
    }
}

// ==========================================
// KHỞI CHẠY
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    updateCartCount();
    loadProduct();
});
