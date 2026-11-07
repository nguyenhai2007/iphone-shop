
// ==========================================
// HẢI APPLE STORE - ĐĂNG NHẬP / ĐĂNG KÝ
// ==========================================

const API_URL = "/api";

let isRegister = false;

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// Hiển thị thông báo
function showMessage(message, type = "error") {
    const element = document.getElementById("auth-message");

    if (!element) return;

    element.textContent = message;
    element.className = type;
}

// Chuyển đổi đăng nhập / đăng ký
function toggleAuth() {
    isRegister = !isRegister;

    const title = document.getElementById("auth-title");
    const description = document.getElementById("auth-description");
    const nameField = document.getElementById("name-field");
    const nameInput = document.getElementById("name");
    const button = document.querySelector(".auth-submit");
    const switchText = document.getElementById("switch-text");
    const toggleButton = document.getElementById("toggle-auth");
    const password = document.getElementById("password");

    title.textContent = isRegister ? "Tạo tài khoản" : "Đăng nhập";

    description.textContent = isRegister
        ? "Đăng ký để trải nghiệm mua sắm tại Hải Apple Store."
        : "Chào mừng bạn quay trở lại!";

    nameField.hidden = !isRegister;
    nameInput.required = isRegister;

    button.textContent = isRegister ? "Đăng ký" : "Đăng nhập";

    switchText.textContent = isRegister
        ? "Bạn đã có tài khoản?"
        : "Bạn chưa có tài khoản?";

    toggleButton.textContent = isRegister
        ? "Đăng nhập ngay"
        : "Đăng ký ngay";

    password.autocomplete = isRegister
        ? "new-password"
        : "current-password";

    showMessage("");
}

// Gửi yêu cầu đăng nhập / đăng ký
async function handleAuth(event) {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (isRegister && !name) {
        showMessage("Vui lòng nhập họ và tên!");
        return;
    }

    if (password.length < 6) {
        showMessage("Mật khẩu phải có ít nhất 6 ký tự!");
        return;
    }

    const button = document.querySelector(".auth-submit");

    button.disabled = true;
    button.textContent = "Đang xử lý...";

    try {
        const endpoint = isRegister ? "/register" : "/login";

        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                email,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Thông tin không chính xác!"
            );
        }

        if (!result.token) {
            throw new Error(
                "Máy chủ chưa trả về token đăng nhập. Vui lòng kiểm tra Backend."
            );
        }

        // Lưu thông tin đăng nhập
        localStorage.setItem("token", result.token);

        if (result.user) {
            localStorage.setItem("user", JSON.stringify(result.user));
            localStorage.setItem("currentUser", JSON.stringify(result.user));
        }

        showMessage(
            isRegister
                ? "Đăng ký thành công!"
                : "Đăng nhập thành công!",
            "success"
        );

        setTimeout(() => {
            if (!isRegister && result.user?.role === "admin") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "index.html";
            }
        }, 700);

    } catch (error) {
        showMessage(error.message);

    } finally {
        button.disabled = false;
        button.textContent = isRegister ? "Đăng ký" : "Đăng nhập";
    }
}

// Khởi chạy
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("authForm")
        ?.addEventListener("submit", handleAuth);

    document.getElementById("toggle-auth")
        ?.addEventListener("click", toggleAuth);
});
