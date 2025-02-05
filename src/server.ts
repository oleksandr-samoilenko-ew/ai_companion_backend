import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { handleDocumentProcessing } from '../routes/documentRoutes';
import { handleQuizGeneration, handleQuizEvaluation } from '../routes/quizRoutes';
import dotenv from 'dotenv';
dotenv.config();

export const app = express();
const port = 3000;

// Middleware setup - only parse JSON for specific content types
app.use((req, res, next) => {
    if (req.is('multipart/form-data')) {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// File handling setup
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, 'uploads/'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});

const upload = multer({ storage });

// CORS middleware
app.use(function (req: Request, res: Response, next: NextFunction) {
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
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.body && !req.is('multipart/form-data')) {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Simple response logging
app.use((req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    res.json = function (body) {
        console.log(`[${new Date().toISOString()}] Response ${res.statusCode} for ${req.url}`);
        return originalJson.call(this, body);
    };
    next();
});

// Error handling
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
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
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Initialize directories
['uploads', 'logs'].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Clean uploads folder
fs.readdirSync('uploads').forEach((file) => {
    fs.unlinkSync(path.join('uploads', file));
});

// Routes
app.post('/api/chat-with-context', upload.array('files', 5), asyncHandler(handleDocumentProcessing));
app.post('/api/quiz/generate', asyncHandler(handleQuizGeneration));
app.post('/api/quiz/evaluate', asyncHandler(handleQuizEvaluation));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
