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
const messages_1 = require("@langchain/core/messages");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const langgraph_1 = require("@langchain/langgraph");
const document_1 = require("langchain/document");
const pinecone_1 = require("@langchain/pinecone");
const pinecone_2 = require("@pinecone-database/pinecone");
const openai_2 = require("@langchain/openai");
const path = __importStar(require("path"));
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const pdf_1 = require("@langchain/community/document_loaders/fs/pdf");
const docx_1 = require("@langchain/community/document_loaders/fs/docx");
const csv_1 = require("@langchain/community/document_loaders/fs/csv");
const text_splitter_1 = require("langchain/text_splitter");
const dotenv_1 = __importDefault(require("dotenv"));
// import pdf from 'pdf-parse';
dotenv_1.default.config();
// Initialize Pinecone
const pinecone = new pinecone_2.Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
// Custom tools for file parsing and Pinecone storage
const parseFileTool = new tools_1.DynamicStructuredTool({
    name: 'parse_file',
    description: 'Parse PDF, DOCX, or CSV file',
    schema: zod_1.z.object({
        filePath: zod_1.z.string(),
    }),
    func: async ({ filePath }) => {
        const fileExtension = path.extname(filePath).toLowerCase();
        const loader = _getLoaderForFileType(fileExtension, filePath);
        const documents = await loader.load();
        return documents;
    },
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
        metadata: zod_1.z.record(zod_1.z.any()),
    }),
    func: async ({ content, metadata }) => {
        const index = pinecone.Index('udemy-offer');
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(new openai_2.OpenAIEmbeddings(), { pineconeIndex: index });
        const doc = new document_1.Document({ pageContent: content, metadata });
        await vectorStore.addDocuments([doc]);
        return 'Content saved to Pinecone successfully';
    },
});
// Define the tools for the agent to use
const tools = [parseFileTool, saveToPineconeTool];
const toolNode = new prebuilt_1.ToolNode(tools);
// Create a model and give it access to the tools
const model = new openai_1.ChatOpenAI({
    modelName: 'gpt-4',
    temperature: 0,
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
    chunkOverlap: 200,
});
// Add a cache to track recently processed documents
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let recentDocuments = new Map();
// Add a new function to query the vector store with optional document filter
async function queryVectorStore(query, recentOnly = false) {
    const index = pinecone.Index('study-companion-db');
    const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(new openai_2.OpenAIEmbeddings(), { pineconeIndex: index });
    let filter = undefined;
    if (recentOnly) {
        // Get document IDs from the last 5 minutes
        const recentDocIds = Array.from(recentDocuments.values())
            .filter((doc) => Date.now() - doc.timestamp < CACHE_DURATION)
            .map((doc) => doc.documentId);
        if (recentDocIds.length > 0) {
            filter = {
                documentId: { $in: recentDocIds },
            };
        }
    }
    const results = await vectorStore.similaritySearch(query, 5, filter);
    return results;
}
async function runAgent(filePath, query) {
    try {
        // If filePath is provided, process and store the document
        if (filePath) {
            // Parse the file directly
            const documents = await parseFileTool.func({ filePath });
            console.log('Parsed documents:', documents);
            // Extract the pageContent from the first document
            const fullContent = documents[0].pageContent;
            // Split the content into chunks
            const chunks = await textSplitter.splitText(fullContent);
            console.log(`Split into ${chunks.length} chunks`);
            // Generate a unique ID for this document
            const documentId = `doc_${Date.now()}`;
            // Add to recent documents cache
            recentDocuments.set(filePath, {
                timestamp: Date.now(),
                documentId: documentId,
            });
            // Clean up old entries from cache
            for (const [path, data] of recentDocuments.entries()) {
                if (Date.now() - data.timestamp > CACHE_DURATION) {
                    recentDocuments.delete(path);
                }
            }
            // Prepare vectors for Pinecone
            const embeddings = new openai_2.OpenAIEmbeddings();
            const vectors = await Promise.all(chunks.map(async (chunk, index) => {
                const vector = await embeddings.embedQuery(chunk);
                return {
                    id: `${documentId}_chunk_${index}`,
                    values: vector,
                    metadata: {
                        text: chunk,
                        documentId: documentId,
                        filePath: filePath,
                        chunkIndex: index,
                        timestamp: Date.now(),
                    },
                };
            }));
            // Save to Pinecone
            const index = pinecone.Index('study-companion-db');
            await index.upsert(vectors);
            console.log(`Saved ${vectors.length} vectors to Pinecone`);
            return {
                status: 'success',
                message: 'Document processed and stored successfully',
            };
        }
        // If query is provided, search through stored documents and respond
        if (query) {
            // First try to find relevant content in recently uploaded documents
            let relevantDocs = await queryVectorStore(query, true);
            // If no results found in recent documents, search all documents
            if (relevantDocs.length === 0) {
                relevantDocs = await queryVectorStore(query, false);
            }
            const context = relevantDocs.map((doc) => doc.pageContent).join('\n\n');
            const chatInstruction = `Based on the following context, please answer the user's question: "${query}"\n\nContext:\n${context}`;
            const chatState = await app.invoke({
                messages: [new messages_1.HumanMessage(chatInstruction)],
            });
            const response = chatState.messages[chatState.messages.length - 1].content;
            return { status: 'success', message: response };
        }
        return {
            status: 'error',
            message: 'Either filePath or query must be provided',
        };
    }
    catch (error) {
        console.error('Error in runAgent:', error);
        if (error instanceof Error) {
            return { status: 'error', message: error.message };
        }
        return { status: 'error', message: 'An unknown error occurred' };
    }
}
