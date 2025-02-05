import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import * as path from 'path';
import { createWorker } from 'tesseract.js';

export class FileHandlerService {
    static async extractContent(filePath: string): Promise<string> {
        const extension = path.extname(filePath).toLowerCase();
        const loader = this.getLoaderForFileType(extension, filePath);

        if (loader) {
            const docs = await loader.load();
            return docs.map((doc) => doc.pageContent).join('\n');
        }

        // Handle image files separately since they need OCR
        if (['.jpg', '.jpeg', '.png'].includes(extension)) {
            return await this.extractImageContent(filePath);
        }

        throw new Error(`Unsupported file type: ${extension}`);
    }

    private static getLoaderForFileType(
        fileExtension: string,
        filePath: string
    ) {
        switch (fileExtension) {
            case '.pdf':
                return new PDFLoader(filePath, { splitPages: false });
            case '.docx':
                return new DocxLoader(filePath);
            case '.csv':
                return new CSVLoader(filePath);
            default:
                return null;
        }
    }

    private static async extractImageContent(
        filePath: string
    ): Promise<string> {
        // Initialize Tesseract.js worker
        const worker = await createWorker('eng');

        try {
            // Perform OCR on the image
            const {
                data: { text },
            } = await worker.recognize(filePath);
            return text;
        } finally {
            await worker.terminate();
        }
    }
}
