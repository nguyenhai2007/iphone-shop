
// ============================================
// HẢI APPLE STORE - TRANG CHỦ
// ============================================

let products = [];

let cart = [];

try {
    const savedCart = JSON.parse(localStorage.getItem("cart") || "[]");
    cart = Array.isArray(savedCart) ? savedCart : [];
} catch (error) {
    cart = [];
}

// ============================================
// HÀM HỖ TRỢ
// ============================================

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

function getSafeImage(image) {
    try {
        const url = new URL(image, window.location.origin);

        if (url.protocol === "http:" || url.protocol === "https:") {
            return escapeHTML(url.href);
        }
    } catch (error) {
        // Dùng ảnh mặc định
    }

    return "images/banner-iphone.png";
}

// ============================================
// GIỎ HÀNG
// ============================================

function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const cartCount = document.getElementById("cart-count");

    if (!cartCount) return;

    const totalQuantity = cart.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
    );

    cartCount.textContent = totalQuantity;
}

// ============================================
// TÀI KHOẢN
// ============================================


function updateAccountLink() {
    const accountLink = document.getElementById("account-link");

    if (!accountLink) return;

    const token = localStorage.getItem("token") ||
        localStorage.getItem("authToken");

    let currentUser = null;

    try {
        currentUser = JSON.parse(
            localStorage.getItem("user") ||
            localStorage.getItem("currentUser") ||
            "null"
        );
    } catch (error) {
        currentUser = null;
    }

    if (!token || !currentUser) {
        accountLink.textContent = "Tài khoản";
        accountLink.href = "login.html";
        return;
    }

    if (currentUser.role === "admin") {
        accountLink.textContent = "Quản trị viên";
        accountLink.href = "admin.html";
    } else {
        accountLink.textContent = currentUser.name || "Tài khoản";
        accountLink.href = "orders.html";
    }
}


// ============================================
// TẢI SẢN PHẨM
// ============================================

async function loadProducts() {
    const grid = document.getElementById("productsGrid");

    if (!grid) return;

    grid.innerHTML = `
        <div class="loading-products">
            Đang tải sản phẩm...
        </div>
    `;

    try {
        const response = await fetch("/api/products");

        if (!response.ok) {
            throw new Error("Không thể tải sản phẩm!");
        }

        const result = await response.json();

        products = Array.isArray(result)
            ? result
            : result.products || result.data || [];

        displayProducts(products);

    } catch (error) {
        console.error("LOAD PRODUCTS ERROR:", error);

        grid.innerHTML = `
            <div class="loading-products">
                Không thể tải sản phẩm. Vui lòng thử lại!
            </div>
        `;
    }
}

// ============================================
// HIỂN THỊ SẢN PHẨM
// ============================================

function displayProducts(productList) {
    const grid = document.getElementById("productsGrid");

    if (!grid) return;

    if (!productList.length) {
        grid.innerHTML = `
            <div class="loading-products">
                Không tìm thấy sản phẩm phù hợp!
            </div>
        `;
        return;
    }

    grid.innerHTML = productList.map(product => {
        const id = Number(product.id);
        const name = escapeHTML(product.name);
        const image = getSafeImage(product.image);

        const price = Number(product.price || 0);
        const originalPrice = Number(product.original_price || 0);
        const stock = Number(product.stock ?? 0);

        return `
            <article class="product-card">

                ${Number(product.featured) === 1
                    ? `<span class="product-badge">Nổi bật</span>`
                    : ""
                }

                <a
                    href="product-detail.html?id=${encodeURIComponent(id)}"
                    class="product-detail-link"
                    aria-label="Xem chi tiết ${name}"
                >
                    <img
                        src="${image}"
                        alt="${name}"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='images/banner-iphone.png';"
                    >

                    <h3>${name}</h3>
                </a>

                <div class="product-price">
                    ${formatPrice(price)}

                    ${originalPrice > price
                        ? `<span class="old-price">
                            ${formatPrice(originalPrice)}
                           </span>`
                        : ""
                    }
                </div>

                <p class="product-stock">
                    ${stock > 0
                        ? `Còn ${stock} sản phẩm`
                        : "Tạm hết hàng"
                    }
                </p>

                <div class="product-card-actions">

                    <a
                        href="product-detail.html?id=${encodeURIComponent(id)}"
                        class="btn-secondary"
                    >
                        Xem chi tiết
                    </a>

                    <button
                        type="button"
                        class="add-cart-button"
                        data-product-id="${id}"
                        ${stock <= 0 ? "disabled" : ""}
                    >
                        ${stock > 0 ? "Thêm vào giỏ" : "Hết hàng"}
                    </button>

                </div>

            </article>
        `;
    }).join("");

    grid.querySelectorAll(".add-cart-button").forEach(button => {
        button.addEventListener("click", () => {
            addToCart(Number(button.dataset.productId));
        });
    });
}

// ============================================
// THÊM VÀO GIỎ HÀNG
// ============================================

function addToCart(productId) {
    const product = products.find(
        item => Number(item.id) === productId
    );

    if (!product) {
        alert("Không tìm thấy sản phẩm!");
        return;
    }

    const stock = Number(product.stock ?? 0);

    if (stock <= 0) {
        alert("Sản phẩm hiện đã hết hàng!");
        return;
    }

    const existingItem = cart.find(
        item => Number(item.id) === productId
    );

    if (existingItem) {
        if (Number(existingItem.quantity) >= stock) {
            alert("Số lượng sản phẩm đã đạt giới hạn tồn kho!");
            return;
        }

        existingItem.quantity =
            Number(existingItem.quantity) + 1;

    } else {
        cart.push({
            id: Number(product.id),
            name: product.name,
            price: Number(product.price),
            image: product.image,
            quantity: 1
        });
    }

    saveCart();

    alert("Đã thêm sản phẩm vào giỏ hàng!");
}

// ============================================
// TÌM KIẾM VÀ SẮP XẾP
// ============================================

function sortProducts() {
    const keyword = document.getElementById("searchInput")
        ?.value.trim().toLowerCase() || "";

    const sortValue = document.getElementById("sortPrice")?.value || "";

    let filteredProducts = products.filter(product =>
        String(product.name || "").toLowerCase().includes(keyword)
    );

    if (sortValue === "asc") {
        filteredProducts.sort(
            (a, b) => Number(a.price) - Number(b.price)
        );
    }

    if (sortValue === "desc") {
        filteredProducts.sort(
            (a, b) => Number(b.price) - Number(a.price)
        );
    }

    displayProducts(filteredProducts);
}

function searchProducts() {
    sortProducts();
}

// ============================================
// KHỞI ĐỘNG
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    updateCartCount();
    updateAccountLink();
    loadProducts();

    document.getElementById("searchInput")
        ?.addEventListener("input", sortProducts);

    document.getElementById("sortPrice")
        ?.addEventListener("change", sortProducts);
});
