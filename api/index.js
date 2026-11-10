
const app = require("../src/index");
const { initDatabase } = require("../src/database");

let databaseReady = null;

module.exports = async (req, res) => {
    try {
        if (!databaseReady) {
            databaseReady = initDatabase().catch((error) => {
                databaseReady = null;
                throw error;
            });
        }

        await databaseReady;

        return app(req, res);
    } catch (error) {
        console.error("VERCEL API ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Máy chủ không thể kết nối cơ sở dữ liệu!"
        });
    }
};
