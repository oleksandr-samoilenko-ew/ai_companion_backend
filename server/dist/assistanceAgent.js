"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
const openai_1 = require("@langchain/openai");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const langgraph_1 = require("@langchain/langgraph");
const document_1 = require("langchain/document");
const pinecone_1 = require("@langchain/pinecone");
const pinecone_2 = require("@pinecone-database/pinecone");
const openai_2 = require("@langchain/openai");
const path = __importStar(require("path"));
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const summarizeAgent_1 = require("./summarizeAgent");
const pdf_1 = require("@langchain/community/document_loaders/fs/pdf");
const docx_1 = require("@langchain/community/document_loaders/fs/docx");
const csv_1 = require("@langchain/community/document_loaders/fs/csv");
const text_splitter_1 = require("langchain/text_splitter");
const dotenv_1 = __importDefault(require("dotenv"));
const fileHandlerService_1 = require("./services/fileHandlerService");
// import pdf from 'pdf-parse';
dotenv_1.default.config();
// Initialize Pinecone
const pinecone = new pinecone_2.Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});
// Custom tools for file parsing and Pinecone storage
const parseFileTool = new tools_1.DynamicStructuredTool({
    name: 'parse_file',
    description: 'Parse PDF, DOCX, or CSV file',
    schema: zod_1.z.object({
        filePath: zod_1.z.string()
    }),
    func: async ({ filePath }) => {
        const fileExtension = path.extname(filePath).toLowerCase();
        const loader = _getLoaderForFileType(fileExtension, filePath);
        const documents = await loader.load();
        return documents;
    }
});
function _getLoaderForFileType(fileExtension, filePath) {
    switch (fileExtension) {
        case '.pdf':
            return new pdf_1.PDFLoader(filePath, { splitPages: false });
        case '.docx':
            return new docx_1.DocxLoader(filePath);
        case '.csv':
            return new csv_1.CSVLoader(filePath);
        default:
            throw new Error(`Unsupported file type: ${fileExtension}`);
    }
}
const saveToPineconeTool = new tools_1.DynamicStructuredTool({
    name: 'save_to_pinecone',
    description: 'Save parsed content to Pinecone vector store',
    schema: zod_1.z.object({
        content: zod_1.z.string(),
        metadata: zod_1.z.record(zod_1.z.any())
    }),
    func: async ({ content, metadata }) => {
        const index = pinecone.Index('study-companion-db');
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(new openai_2.OpenAIEmbeddings(), { pineconeIndex: index });
        const doc = new document_1.Document({ pageContent: content, metadata });
        await vectorStore.addDocuments([doc]);
        return 'Content saved to Pinecone successfully';
    }
});
// Define the tools for the agent to use
const tools = [parseFileTool, saveToPineconeTool];
const toolNode = new prebuilt_1.ToolNode(tools);
// Create a model and give it access to the tools
const model = new openai_1.ChatOpenAI({
    modelName: 'gpt-4',
    temperature: 0
}).bindTools(tools);
// Define the function that determines whether to continue or not
function shouldContinue({ messages }) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.additional_kwargs.tool_calls) {
        return 'tools';
    }
    return '__end__';
}
// Define the function that calls the model
async function callModel(state) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
}
// Define a new graph
const workflow = new langgraph_1.StateGraph(langgraph_1.MessagesAnnotation)
    .addNode('agent', callModel)
    .addEdge('__start__', 'agent')
    .addNode('tools', toolNode)
    .addEdge('tools', 'agent')
    .addConditionalEdges('agent', shouldContinue);
// Compile the graph into a LangChain Runnable
const app = workflow.compile();
const textSplitter = new text_splitter_1.RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
});
async function runAgent(filePath, query) {
    try {
        if (filePath) {
            // Process and store the document content
            const index = pinecone.Index('study-companion-db');
            // Generate a unique ID for this document that doesn't include timestamp
            const documentId = `doc_${Math.random().toString(36).substring(7)}`;
            console.log('Generated document ID:', documentId);
            // Get the file content using FileHandlerService
            const fileContent = await fileHandlerService_1.FileHandlerService.extractContent(filePath);
            console.log('Extracted content length:', fileContent.length);
            // Split the content into chunks
            const chunks = await textSplitter.splitText(fileContent);
            console.log('Number of chunks created:', chunks.length);
            // Prepare vectors for Pinecone
            const documents = chunks.map((chunk, index) => {
                const metadata = {
                    documentId: documentId,
                    filePath: filePath,
                    chunkIndex: index,
                    contentLength: chunk.length,
                    pageContent: chunk
                };
                console.log(`Chunk ${index} metadata:`, metadata);
                return new document_1.Document({
                    pageContent: chunk,
                    metadata: metadata
                });
            });
            // Add documents to vector store
            console.log('Storing documents in Pinecone...');
            const embeddings = new openai_2.OpenAIEmbeddings();
            const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, { pineconeIndex: index });
            // Log the first document's embedding for debugging
            const firstEmbedding = await embeddings.embedQuery(documents[0].pageContent);
            console.log('Sample embedding dimension:', firstEmbedding.length);
            // Delete existing vectors for this file path if they exist
            try {
                const existingVectors = await index.query({
                    vector: firstEmbedding,
                    topK: 10000,
                    filter: {
                        filePath: filePath
                    }
                });
                if (existingVectors.matches.length > 0) {
                    const ids = existingVectors.matches.map((match) => match.id);
                    await index.deleteMany(ids);
                    console.log(`Deleted ${ids.length} existing vectors for this file`);
                }
            }
            catch (error) {
                console.log('No existing vectors found or error deleting:', error);
            }
            await vectorStore.addDocuments(documents);
            console.log('Successfully stored documents in Pinecone');
            // Call getTopCourses after storing documents with isDocumentId=true
            // const coursesResult = await getTopCourses('test');
            // console.log('Top courses result:', coursesResult);
            return {
                status: 'success',
                message: 'Document processed and stored successfully',
                documentId: documentId,
                chunkCount: chunks.length
                // courses: coursesResult
            };
        }
        if (query) {
            const index = pinecone.Index('study-companion-db');
            const result = await (0, summarizeAgent_1.getTopCourses)('give a brief summary of the content ');
            console.log('pinecone result', result);
            return {
                status: 'success',
                message: result
            };
        }
        return {
            status: 'error',
            message: 'No file or query provided'
        };
    }
    catch (error) {
        console.error('Error in runAgent:', error);
        throw error;
    }
}
