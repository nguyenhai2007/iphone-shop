
// ==========================================
// HẢI APPLE STORE - QUẢN LÝ SẢN PHẨM
// ==========================================

const API_URL = "/api";

let products = [];

function formatPrice(price) {
    return Number(price || 0).toLocaleString("vi-VN") + "đ";
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

// Token đăng nhập
function getToken() {
    return localStorage.getItem("token") ||
           localStorage.getItem("authToken") ||
           "";
}

// Gọi API
async function apiRequest(url, options = {}) {
    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getToken()}`,
            ...options.headers
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(result.message || "Có lỗi xảy ra!");
    }

    return result;
}

// Kiểm tra quyền quản trị
async function checkAdmin() {
    if (!getToken()) {
        alert("Vui lòng đăng nhập tài khoản quản trị!");
        window.location.href = "login.html";
        return false;
    }

    try {
        const result = await apiRequest("/me");

        const user = result.user || result;

        if (user.role !== "admin") {
            alert("Bạn không có quyền truy cập trang quản trị!");
            window.location.href = "index.html";
            return false;
        }

        return true;

    } catch (error) {
        alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại!");
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");

        window.location.href = "login.html";
        return false;
    }
}

// Tải sản phẩm
async function loadProducts() {
    const container = document.getElementById("adminProducts");

    container.innerHTML = `
        <p class="loading-products">Đang tải sản phẩm...</p>
    `;

    try {
        const result = await apiRequest("/products");

        products = Array.isArray(result)
            ? result
            : result.products || result.data || [];

        displayProducts();

    } catch (error) {
        container.innerHTML = `
            <p class="product-message">
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}

// Hiển thị sản phẩm
function displayProducts() {
    const container = document.getElementById("adminProducts");

    if (!products.length) {
        container.innerHTML = `
            <div class="empty-orders">
                <h3>Chưa có sản phẩm</h3>
                <p>Hãy thêm sản phẩm đầu tiên.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = products.map(product => `
        <div class="admin-product-card">

            <div class="admin-product-info">
                <img src="${escapeHTML(product.image || "images/banner-iphone.png")}"
                     alt="${escapeHTML(product.name)}"
                     onerror="this.src='images/banner-iphone.png'">

                <div>
                    <h3>${escapeHTML(product.name)}</h3>

                    <p>
                        Mã sản phẩm: ${Number(product.id)}
                    </p>

                    <strong>
                        ${formatPrice(product.price)}
                    </strong>
                </div>
            </div>

            <div class="admin-product-actions">

                <button class="btn-secondary"
                        onclick="editProduct(${Number(product.id)})">
                    Sửa
                </button>

                <button class="btn-danger"
                        onclick="deleteProduct(${Number(product.id)})">
                    Xóa
                </button>

            </div>

        </div>
    `).join("");
}

// Thêm hoặc cập nhật sản phẩm
async function saveProduct(event) {
    event.preventDefault();

    const id = document.getElementById("productId").value;
    const name = document.getElementById("productName").value.trim();
    const price = Number(document.getElementById("productPrice").value);
    const image = document.getElementById("productImage").value.trim();

    if (!name || !Number.isFinite(price) || price <= 0) {
        alert("Vui lòng nhập tên và giá sản phẩm hợp lệ!");
        return;
    }

    const button = document.getElementById("saveButton");

    button.disabled = true;
    button.textContent = "Đang lưu...";

    try {
        const data = { name, price, image };

        if (id) {
            await apiRequest(`/products/${id}`, {
                method: "PUT",
                body: JSON.stringify(data)
            });

            alert("Cập nhật sản phẩm thành công!");

        } else {
            await apiRequest("/products", {
                method: "POST",
                body: JSON.stringify(data)
            });

            alert("Thêm sản phẩm thành công!");
        }

        resetProductForm();
        await loadProducts();

    } catch (error) {
        alert(error.message);

    } finally {
        button.disabled = false;
        button.textContent = id ? "Cập nhật sản phẩm" : "Thêm sản phẩm";
    }
}

// Chỉnh sửa sản phẩm
function editProduct(id) {
    const product = products.find(item => Number(item.id) === Number(id));

    if (!product) return;

    document.getElementById("productId").value = product.id;
    document.getElementById("productName").value = product.name || "";
    document.getElementById("productPrice").value = product.price || "";
    document.getElementById("productImage").value = product.image || "";

    document.getElementById("saveButton").textContent =
        "Cập nhật sản phẩm";

    document.getElementById("cancelButton").hidden = false;

    document.getElementById("product-form-title").textContent =
        "Chỉnh sửa sản phẩm";

    document.getElementById("productForm").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// Xóa sản phẩm
async function deleteProduct(id) {
    const product = products.find(item => Number(item.id) === Number(id));

    if (!product) return;

    const confirmed = confirm(
        `Bạn có chắc muốn xóa "${product.name}" không?`
    );

    if (!confirmed) return;

    try {
        await apiRequest(`/products/${id}`, {
            method: "DELETE"
        });

        alert("Đã xóa sản phẩm!");

        await loadProducts();

    } catch (error) {
        alert(error.message);
    }
}

// Đặt lại biểu mẫu
function resetProductForm() {
    document.getElementById("productForm").reset();
    document.getElementById("productId").value = "";

    document.getElementById("saveButton").textContent =
        "Thêm sản phẩm";

    document.getElementById("cancelButton").hidden = true;

    document.getElementById("product-form-title").textContent =
        "Thêm sản phẩm mới";
}

// Đăng xuất
function logoutAdmin() {
    if (!confirm("Bạn có muốn đăng xuất không?")) return;

    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    window.location.href = "login.html";
}

// Khởi chạy
document.addEventListener("DOMContentLoaded", async () => {
    const isAdmin = await checkAdmin();

    if (!isAdmin) return;

    document.getElementById("productForm")
        .addEventListener("submit", saveProduct);

    document.getElementById("cancelButton")
        .addEventListener("click", resetProductForm);

    document.getElementById("logoutButton")
        .addEventListener("click", logoutAdmin);

    document.getElementById("refreshProducts")
        ?.addEventListener("click", loadProducts);

    await loadProducts();
});
