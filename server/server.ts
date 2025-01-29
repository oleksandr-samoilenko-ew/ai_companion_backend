import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processDocument, queryDocument } from './documentAgent';

const app = express();
const port = 3000;

app.use(express.json());
app.use(bodyParser.raw({ type: 'application/json' }));

// Multer configuration
const storage = multer.diskStorage({
    destination: function (_req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
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

// Combined file and chat endpoint
app.post(
    '/api/chat-with-context',
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
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
            const processResult = await processDocument(filePath);

            if (processResult.status === 'success') {
                // Now process the query with the document ID
                const queryResult = await queryDocument(query, processResult.documentId);

                // Clean up the uploaded file
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Error deleting file:', err);
                });

                res.json({
                    ...queryResult,
                    documentId: processResult.documentId
                });
            } else {
                res.status(500).json({
                    status: 'error',
                    message: 'Failed to process document'
                });
            }
        } catch (error) {
            console.error('Error processing request:', error);
            res.status(500).send('Error processing request');
        }
    })
);

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads/')) {
    fs.mkdirSync('uploads/');
}

// Clean uploads folder on startup
cleanUploadsFolder();

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
