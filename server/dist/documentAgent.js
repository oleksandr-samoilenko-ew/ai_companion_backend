"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDocument = processDocument;
exports.queryDocument = queryDocument;
const openai_1 = require("@langchain/openai");
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
    apiKey: process.env.PINECONE_API_KEY,
});
// Text splitter configuration
const textSplitter = new text_splitter_1.RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
});
// Custom tools for the agent
const extractContentTool = new tools_1.DynamicStructuredTool({
    name: 'extract_content',
    description: 'Extract content from a file using FileHandlerService',
    schema: zod_1.z.object({
        filePath: zod_1.z.string(),
    }),
    func: async ({ filePath }) => {
        const content = await fileHandlerService_1.FileHandlerService.extractContent(filePath);
        return content;
    },
});
const splitTextTool = new tools_1.DynamicStructuredTool({
    name: 'split_text',
    description: 'Split text content into chunks',
    schema: zod_1.z.object({
        content: zod_1.z.string(),
    }),
    func: async ({ content }) => {
        const chunks = await textSplitter.splitText(content);
        return chunks;
    },
});
const saveToPineconeTool = new tools_1.DynamicStructuredTool({
    name: 'save_to_pinecone',
    description: 'Save content chunks to Pinecone vector store',
    schema: zod_1.z.object({
        chunks: zod_1.z.array(zod_1.z.string()),
        metadata: zod_1.z.record(zod_1.z.any()),
    }),
    func: async ({ chunks, metadata }) => {
        const index = pinecone.Index('study-companion-db');
        const embeddings = new openai_2.OpenAIEmbeddings();
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
        });
        const documents = chunks.map((chunk, index) => {
            return new document_1.Document({
                pageContent: chunk,
                metadata: {
                    ...metadata,
                    chunkIndex: index,
                },
            });
        });
        await vectorStore.addDocuments(documents);
        return 'Content saved to Pinecone successfully';
    },
});
const queryPineconeTool = new tools_1.DynamicStructuredTool({
    name: 'query_pinecone',
    description: 'Query Pinecone vector store for relevant content',
    schema: zod_1.z.object({
        query: zod_1.z.string(),
    }),
    func: async ({ query }) => {
        const index = pinecone.Index('study-companion-db');
        const embeddings = new openai_2.OpenAIEmbeddings();
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
        });
        const results = await vectorStore.similaritySearch(query, 3);
        return JSON.stringify(results);
    },
});
// Define the tools for the agent to use
const tools = [
    extractContentTool,
    splitTextTool,
    saveToPineconeTool,
    queryPineconeTool,
];
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
// Define the graph
const workflow = new langgraph_1.StateGraph(langgraph_1.MessagesAnnotation)
    .addNode('agent', callModel)
    .addEdge('__start__', 'agent')
    .addNode('tools', toolNode)
    .addEdge('tools', 'agent')
    .addConditionalEdges('agent', shouldContinue);
// Compile the graph into a LangChain Runnable
const app = workflow.compile();
// Add this helper function at the top level
async function retryWithExponentialBackoff(operation, maxRetries = 5, initialDelay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await operation();
            if (Array.isArray(result) &&
                result.length === 0 &&
                i < maxRetries - 1) {
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
async function processDocument(filePath) {
    try {
        const documentId = `doc_${Math.random().toString(36).substring(7)}`;
        // First, extract content
        console.log('Extracting content from file:', filePath);
        const content = await fileHandlerService_1.FileHandlerService.extractContent(filePath);
        console.log('Extracted content length:', content.length);
        // Split content into chunks
        console.log('Splitting content into chunks...');
        const chunks = await textSplitter.splitText(content);
        console.log('Number of chunks:', chunks.length);
        // Prepare metadata
        const metadata = {
            documentId,
            filePath,
            timestamp: new Date().toISOString(),
            source: 'document_processor',
        };
        // Save to Pinecone
        console.log('Saving chunks to Pinecone...');
        const index = pinecone.Index('study-companion-db');
        const embeddings = new openai_2.OpenAIEmbeddings();
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
        });
        const documents = chunks.map((chunk, index) => {
            return new document_1.Document({
                pageContent: chunk,
                metadata: {
                    ...metadata,
                    chunkIndex: index,
                },
            });
        });
        await vectorStore.addDocuments(documents);
        console.log('Successfully saved documents to Pinecone');
        return {
            status: 'success',
            message: `Document processed and stored successfully. Created ${chunks.length} chunks.`,
            documentId,
        };
    }
    catch (error) {
        console.error('Error processing document:', error);
        throw error;
    }
}
async function queryDocument(query, documentId) {
    try {
        console.log('Querying Pinecone with:', query);
        console.log('Filtering by documentId:', documentId);
        const index = pinecone.Index('study-companion-db');
        const embeddings = new openai_2.OpenAIEmbeddings();
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
            filter: { documentId: documentId },
        });
        // Search for relevant documents with retry mechanism
        console.log('Performing similarity search with retries...');
        const results = await retryWithExponentialBackoff(async () => {
            const searchResults = await vectorStore.similaritySearch(query, 3);
            console.log(`Found ${searchResults.length} relevant documents for documentId: ${documentId}`);
            return searchResults;
        });
        if (results.length === 0) {
            return {
                status: 'error',
                message: 'No relevant content found in the document. Please try a different query.',
            };
        }
        // Use GPT to generate a summary
        const model = new openai_1.ChatOpenAI({
            modelName: 'gpt-4',
            temperature: 0,
        });
        const summaryPrompt = `Based on the following content from the document, provide a concise and coherent summary that addresses this query: "${query}"

Content:
${results
            .map((doc, i) => `[Document ${i + 1}]:\n${doc.pageContent}`)
            .join('\n\n')}

Summary:`;
        const response = await model.invoke(summaryPrompt);
        return {
            status: 'success',
            message: typeof response.content === 'string'
                ? response.content
                : Array.isArray(response.content)
                    ? response.content
                        .map((c) => typeof c === 'string' ? c : JSON.stringify(c))
                        .join(' ')
                    : JSON.stringify(response.content),
        };
    }
    catch (error) {
        console.error('Error querying document:', error);
        throw error;
    }
}
