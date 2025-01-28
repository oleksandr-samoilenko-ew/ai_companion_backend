"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const assistanceAgent_js_1 = require("./assistanceAgent.js");
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
const port = 3000;
app.use(express_1.default.json());
app.use(body_parser_1.default.raw({ type: 'application/json' }));
// Multer configuration
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path_1.default.extname(file.originalname));
    },
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
// File upload endpoint
app.post('/api/upload-file', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    try {
        const result = await (0, assistanceAgent_js_1.runAgent)(req.file.path);
        // Clean up the uploaded file
        fs_1.default.unlink(req.file.path, (err) => {
            if (err)
                console.error('Error deleting file:', err);
        });
        res.json(result);
    }
    catch (error) {
        console.error('Error processing file:', error);
        res.status(500).send('Error processing file');
    }
}));
// Chat query endpoint
app.post('/api/chat', asyncHandler(async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).send('No query provided');
    }
    try {
        const result = await (0, assistanceAgent_js_1.runAgent)(undefined, query);
        res.json(result);
    }
    catch (error) {
        console.error('Error processing query:', error);
        res.status(500).send('Error processing query');
    }
}));
// Combined file and chat endpoint
app.post('/api/chat-with-context', upload.single('file'), asyncHandler(async (req, res) => {
    // const query = req.body.query;
    const query = 'what is flutter, give a brief smmary';
    // if (!query) {
    //     return res.status(400).send('No query provided');
    // }
    const filePath = '/Users/alex/StudioProjects/trainings/ai-study-companion-app/server/test_file.pdf';
    try {
        let result;
        // If a file is provided, process it first
        // if (req.file) {
        if (filePath) {
            await (0, assistanceAgent_js_1.runAgent)(filePath);
            // Clean up the uploaded file
            fs_1.default.unlink(filePath, (err) => {
                if (err)
                    console.error('Error deleting file:', err);
            });
        }
        // Then process the query
        result = await (0, assistanceAgent_js_1.runAgent)(undefined, query);
        res.json(result);
    }
    catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Error processing request');
    }
}));
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
