const db = require("./database");
const bcrypt = require("bcryptjs");

const password = bcrypt.hashSync("Admin123456", 12);

const result = db.prepare(`
    INSERT OR IGNORE INTO users (name, email, password, role)
    VALUES (?, ?, ?, 'admin')
`).run("Quan tri vien", "admin@iphoneshop.com", password);

console.log(
    result.changes === 1
        ? "Da tao tai khoan Admin!"
        : "Tai khoan Admin da ton tai!"
);

db.close();