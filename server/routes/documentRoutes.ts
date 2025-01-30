import { Request, Response } from 'express';
import { processDocument, queryDocument } from '../documentAgent';
import fs from 'fs';

interface FileInfo {
    path: string;
    originalname: string;
}

interface ProcessedDocument {
    documentId: string;
    fileName: string;
    status: string;
    message?: string; // Optional error message
}

interface DocumentRequest {
    query?: string;
    filePaths?: string[]; // Array of file paths
}

export async function handleDocumentProcessing(req: Request, res: Response) {
    // Get query from either form-data or JSON body
    const query =
        req.body.query ||
        (req as any).query ||
        'give brief summary of these files';
    const filePaths: string[] = Array.isArray(req.body.filePaths)
        ? req.body.filePaths
        : [];

    let filesToProcess: FileInfo[] = [];

    // Check if files were uploaded via multer
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    if (uploadedFiles && uploadedFiles.length > 0) {
        console.log(
            'Processing uploaded files:',
            uploadedFiles.map((f) => f.originalname)
        );
        filesToProcess.push(
            ...uploadedFiles.map((file) => ({
                path: file.path,
                originalname: file.originalname,
            }))
        );
    }

    // Add manually specified file paths
    if (filePaths.length > 0) {
        console.log('Processing file paths:', filePaths);
        filesToProcess.push(
            ...filePaths.map((filePath: string) => ({
                path: filePath,
                originalname: filePath.split('/').pop() || filePath,
            }))
        );
    }

    // If no files were provided (neither uploaded nor paths), use default files
    // if (filesToProcess.length === 0) {
    //     console.log('No files provided, using default files');
    //     filesToProcess = [
    //         {
    //             path: '/Users/alex/StudioProjects/trainings/ai-study-companion-app/server/test/ai_sample.png',
    //             originalname: 'ai_sample.png',
    //         },
    //     ];
    // }

    // Generate a single documentId for all files
    const sharedDocumentId = `doc_${Math.random().toString(36).substring(7)}`;

    try {
        // Process all documents
        const processedDocs: ProcessedDocument[] = [];
        for (const file of filesToProcess) {
            try {
                console.log(`Processing file: ${file.originalname}`);
                if (!fs.existsSync(file.path)) {
                    console.error(`File not found: ${file.path}`);
                    processedDocs.push({
                        documentId: sharedDocumentId,
                        fileName: file.originalname,
                        status: 'error',
                        message: 'File not found',
                    });
                    continue;
                }

                const processResult = await processDocument(
                    file.path,
                    sharedDocumentId
                );
                processedDocs.push({
                    documentId: processResult.documentId,
                    fileName: file.originalname,
                    status: processResult.status,
                });

                // Only delete the file if it was uploaded via multer
                if (uploadedFiles?.some((f) => f.path === file.path)) {
                    fs.unlink(file.path, (err) => {
                        if (err) console.error('Error deleting file:', err);
                    });
                }
            } catch (error) {
                console.error(
                    `Error processing file ${file.originalname}:`,
                    error
                );
                processedDocs.push({
                    documentId: sharedDocumentId,
                    fileName: file.originalname,
                    status: 'error',
                    message:
                        error instanceof Error ? error.message : String(error),
                });
            }
        }

        // Check if any documents were processed successfully
        const successfulDocs = processedDocs.filter(
            (doc) => doc.status === 'success'
        );
        if (successfulDocs.length === 0) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to process any documents',
                processedFiles: processedDocs,
            });
        }

        // Get unique documentIds
        const uniqueDocumentIds = [
            ...new Set(successfulDocs.map((doc) => doc.documentId)),
        ];

        // Query once per unique documentId
        const queryResults = await Promise.all(
            uniqueDocumentIds.map(async (documentId) => {
                const docsWithThisId = successfulDocs.filter(
                    (doc) => doc.documentId === documentId
                );
                const fileNames = docsWithThisId.map((doc) => doc.fileName);

                try {
                    const result = await queryDocument(query, documentId);
                    return {
                        ...result,
                        fileNames,
                        documentId,
                    };
                } catch (error) {
                    console.error(
                        `Error querying document ${documentId}:`,
                        error
                    );
                    return {
                        status: 'error',
                        message: `Failed to query documents`,
                        fileNames,
                        documentId,
                    };
                }
            })
        );

        res.json({
            status: 'success',
            results: queryResults,
            processedFiles: processedDocs,
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error processing request',
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
