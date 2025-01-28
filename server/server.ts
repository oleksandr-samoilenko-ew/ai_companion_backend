import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';

import multer from 'multer';
import path from 'path';
import { runAgent } from './assistanceAgent.js';
import fs from 'fs';

const app = express();
const port = 3000;
app.use(express.json());
app.use(bodyParser.raw({ type: 'application/json' }));

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

function cleanUploadsFolder() {
    const directory = 'uploads/';
    fs.readdir(directory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            fs.unlink(path.join(directory, file), (err) => {
                if (err) throw err;
            });
        }
    });
}
const upload = multer({ storage: storage });

// Wrapper for async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// File upload endpoint
app.post(
    '/api/upload-file',
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        try {
            const result = await runAgent(req.file.path);
            // Clean up the uploaded file
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
            res.json(result);
        } catch (error) {
            console.error('Error processing file:', error);
            res.status(500).send('Error processing file');
        }
    })
);

// Chat query endpoint
app.post(
    '/api/chat',
    asyncHandler(async (req: Request, res: Response) => {
        const { query } = req.body;

        if (!query) {
            return res.status(400).send('No query provided');
        }

        try {
            const result = await runAgent(undefined, query);
            res.json(result);
        } catch (error) {
            console.error('Error processing query:', error);
            res.status(500).send('Error processing query');
        }
    })
);

// Combined file and chat endpoint
app.post(
    '/api/chat-with-context',
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
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
                await runAgent(filePath);
                // Clean up the uploaded file
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Error deleting file:', err);
                });
            }

            // Then process the query
            result = await runAgent(undefined, query);
            res.json(result);
        } catch (error) {
            console.error('Error processing request:', error);
            res.status(500).send('Error processing request');
        }
    })
);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
