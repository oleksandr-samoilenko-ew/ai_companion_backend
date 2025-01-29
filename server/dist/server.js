"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const documentAgent_1 = require("./documentAgent");
const app = (0, express_1.default)();
const port = 3000;
app.use(express_1.default.json());
app.use(body_parser_1.default.raw({ type: 'application/json' }));
// Multer configuration
const storage = multer_1.default.diskStorage({
    destination: function (_req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path_1.default.extname(file.originalname));
    }
});
function cleanUploadsFolder() {
    const directory = 'uploads/';
    fs_1.default.readdir(directory, (err, files) => {
        if (err)
            throw err;
        for (const file of files) {
            fs_1.default.unlink(path_1.default.join(directory, file), (err) => {
                if (err)
                    throw err;
            });
        }
    });
}
const upload = (0, multer_1.default)({ storage: storage });
// Wrapper for async route handlers
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// Combined file and chat endpoint
app.post('/api/chat-with-context', upload.single('file'), asyncHandler(async (req, res) => {
    const query = req.body.query || 'give brief summary of this file';
    const filePath = req.file?.path || '/Users/alex/StudioProjects/trainings/ai-study-companion-app/server/test/ai_sample.png';
    try {
        if (!filePath) {
            return res.status(400).json({
                status: 'error',
                message: 'No file provided'
            });
        }
        // First process and store the document
        const processResult = await (0, documentAgent_1.processDocument)(filePath);
        if (processResult.status === 'success') {
            // Now process the query with the document ID
            const queryResult = await (0, documentAgent_1.queryDocument)(query, processResult.documentId);
            // Clean up the uploaded file
            fs_1.default.unlink(filePath, (err) => {
                if (err)
                    console.error('Error deleting file:', err);
            });
            res.json({
                ...queryResult,
                documentId: processResult.documentId
            });
        }
        else {
            res.status(500).json({
                status: 'error',
                message: 'Failed to process document'
            });
        }
    }
    catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Error processing request');
    }
}));
// Create uploads directory if it doesn't exist
if (!fs_1.default.existsSync('uploads/')) {
    fs_1.default.mkdirSync('uploads/');
}
// Clean uploads folder on startup
cleanUploadsFolder();
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
