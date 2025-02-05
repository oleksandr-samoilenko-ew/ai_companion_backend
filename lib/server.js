"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const documentRoutes_1 = require("./routes/documentRoutes");
const quizRoutes_1 = require("./routes/quizRoutes");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.app = (0, express_1.default)();
const port = 3000;
// Middleware setup - only parse JSON for specific content types
exports.app.use((req, res, next) => {
    if (req.is('multipart/form-data')) {
        next();
    }
    else {
        express_1.default.json()(req, res, next);
    }
});
// File handling setup
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, 'uploads/'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = (0, multer_1.default)({ storage });
// CORS middleware
exports.app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
// Simple request logging
exports.app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.body && !req.is('multipart/form-data')) {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});
// Simple response logging
exports.app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        console.log(`[${new Date().toISOString()}] Response ${res.statusCode} for ${req.url}`);
        return originalJson.call(this, body);
    };
    next();
});
// Error handling
exports.app.use((err, _req, res, next) => {
    console.error('Error:', err.message);
    if (!res.headersSent) {
        res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
    next(err);
});
// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Initialize directories
['uploads', 'logs'].forEach((dir) => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir);
    }
});
// Clean uploads folder
fs_1.default.readdirSync('uploads').forEach((file) => {
    fs_1.default.unlinkSync(path_1.default.join('uploads', file));
});
// Routes
exports.app.post('/api/chat-with-context', upload.array('files', 5), asyncHandler(documentRoutes_1.handleDocumentProcessing));
exports.app.post('/api/quiz/generate', asyncHandler(quizRoutes_1.handleQuizGeneration));
exports.app.post('/api/quiz/evaluate', asyncHandler(quizRoutes_1.handleQuizEvaluation));
exports.app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map