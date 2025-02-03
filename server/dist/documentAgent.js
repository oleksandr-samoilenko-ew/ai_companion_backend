"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDocument = processDocument;
exports.queryDocument = queryDocument;
const openai_1 = require("@langchain/openai");
const messages_1 = require("@langchain/core/messages");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const langgraph_1 = require("@langchain/langgraph");
const document_1 = require("langchain/document");
const pinecone_1 = require("@langchain/pinecone");
const pinecone_2 = require("@pinecone-database/pinecone");
const openai_2 = require("@langchain/openai");
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const text_splitter_1 = require("langchain/text_splitter");
const fileHandlerService_1 = require("./services/fileHandlerService");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize Pinecone
const pinecone = new pinecone_2.Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});
// Text splitter configuration
const textSplitter = new text_splitter_1.RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
});
// Custom tools for document processing
const extractContentTool = new tools_1.DynamicStructuredTool({
    name: 'extract_content',
    description: 'Extract content from a file using FileHandlerService',
    schema: zod_1.z.object({
        filePath: zod_1.z.string()
    }),
    func: async ({ filePath }) => {
        const content = await fileHandlerService_1.FileHandlerService.extractContent(filePath);
        return content;
    }
});
const splitTextTool = new tools_1.DynamicStructuredTool({
    name: 'split_text',
    description: 'Split text content into chunks',
    schema: zod_1.z.object({
        content: zod_1.z.string()
    }),
    func: async ({ content }) => {
        const chunks = await textSplitter.splitText(content);
        return JSON.stringify(chunks);
    }
});
const saveToPineconeTool = new tools_1.DynamicStructuredTool({
    name: 'save_to_pinecone',
    description: 'Save content chunks to Pinecone vector store',
    schema: zod_1.z.object({
        chunks: zod_1.z.array(zod_1.z.string()),
        documentId: zod_1.z.string(),
        metadata: zod_1.z.record(zod_1.z.any()).optional()
    }),
    func: async ({ chunks, documentId, metadata = {} }) => {
        const index = pinecone.Index('study-companion-db');
        const embeddings = new openai_2.OpenAIEmbeddings();
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index
        });
        const documents = chunks.map((chunk, index) => {
            return new document_1.Document({
                pageContent: chunk,
                metadata: {
                    ...metadata,
                    documentId,
                    chunkIndex: index
                }
            });
        });
        await vectorStore.addDocuments(documents);
        return `Successfully saved ${chunks.length} chunks to Pinecone with documentId: ${documentId}`;
    }
});
// Custom tool for document querying
const queryPineconeTool = new tools_1.DynamicStructuredTool({
    name: 'query_pinecone',
    description: 'Query Pinecone vector store for relevant content',
    schema: zod_1.z.object({
        query: zod_1.z.string(),
        documentId: zod_1.z.string()
    }),
    func: async ({ query, documentId }) => {
        const index = pinecone.Index('study-companion-db');
        const embeddings = new openai_2.OpenAIEmbeddings();
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
            filter: { documentId }
        });
        const results = await retryWithExponentialBackoff(async () => {
            const searchResults = await vectorStore.similaritySearch(query, 3);
            return searchResults;
        });
        return JSON.stringify(results);
    }
});
// Define tool sets for different workflows
const processingTools = [extractContentTool, splitTextTool, saveToPineconeTool];
const queryingTools = [queryPineconeTool];
// Create processing model and tool node
const processingModel = new openai_1.ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0
}).bindTools(processingTools);
const processingToolNode = new prebuilt_1.ToolNode(processingTools);
// Create querying model and tool node
const queryingModel = new openai_1.ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0
}).bindTools(queryingTools);
const queryingToolNode = new prebuilt_1.ToolNode(queryingTools);
// Define the function that determines whether to continue or not
function shouldContinue({ messages }) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.additional_kwargs.tool_calls) {
        return 'tools';
    }
    return '__end__';
}
// Define the model calling functions
async function callProcessingModel(state) {
    const response = await processingModel.invoke(state.messages);
    return { messages: [response] };
}
async function callQueryingModel(state) {
    const response = await queryingModel.invoke(state.messages);
    return { messages: [response] };
}
// Create the processing workflow
const processingWorkflow = new langgraph_1.StateGraph(langgraph_1.MessagesAnnotation)
    .addNode('agent', callProcessingModel)
    .addEdge('__start__', 'agent')
    .addNode('tools', processingToolNode)
    .addEdge('tools', 'agent')
    .addConditionalEdges('agent', shouldContinue);
// Create the querying workflow
const queryingWorkflow = new langgraph_1.StateGraph(langgraph_1.MessagesAnnotation)
    .addNode('agent', callQueryingModel)
    .addEdge('__start__', 'agent')
    .addNode('tools', queryingToolNode)
    .addEdge('tools', 'agent')
    .addConditionalEdges('agent', shouldContinue);
// Compile the workflows
const processingApp = processingWorkflow.compile();
const queryingApp = queryingWorkflow.compile();
// Helper function for retrying operations
async function retryWithExponentialBackoff(operation, maxRetries = 5, initialDelay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await operation();
            if (Array.isArray(result) && result.length === 0 && i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                console.log(`No results found, retrying in ${delay / 1000} seconds... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }
            return result;
        }
        catch (error) {
            if (i === maxRetries - 1)
                throw error;
            const delay = initialDelay * Math.pow(2, i);
            console.log(`Error occurred, retrying in ${delay / 1000} seconds... (Attempt ${i + 1}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error('Max retries reached');
}
// Main processing function
async function processDocument(filePath, existingDocumentId) {
    try {
        const documentId = existingDocumentId || `doc_${Math.random().toString(36).substring(7)}`;
        console.log('Processing document:', filePath, 'with ID:', documentId);
        const systemPrompt = `You are a document processing assistant. Process the document by:
1. Extracting content from the file
2. Splitting the content into chunks
3. Saving the chunks to Pinecone with proper metadata
Use the available tools in sequence to accomplish this task.`;
        const result = await processingApp.invoke({
            messages: [new messages_1.SystemMessage(systemPrompt), new messages_1.HumanMessage(`Process this document: ${filePath} with documentId: ${documentId}`)]
        });
        const lastMessage = result.messages[result.messages.length - 1];
        const message = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
        return {
            status: 'success',
            message,
            documentId
        };
    }
    catch (error) {
        console.error('Error processing document:', error);
        throw error;
    }
}
// Main querying function
async function queryDocument(query, documentId) {
    try {
        console.log('Querying document:', documentId, 'with query:', query);
        const systemPrompt = `You are a document querying assistant. Your task is to:
1. Search the document for relevant content using the provided query
2. Analyze the search results
3. Provide a clear, concise response that directly addresses the query
Use the available tools to accomplish this task.`;
        const result = await queryingApp.invoke({
            messages: [new messages_1.SystemMessage(systemPrompt), new messages_1.HumanMessage(`Find information about: "${query}" in document: ${documentId}`)]
        });
        const lastMessage = result.messages[result.messages.length - 1];
        const message = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
        return {
            status: 'success',
            message
        };
    }
    catch (error) {
        console.error('Error querying document:', error);
        throw error;
    }
}
