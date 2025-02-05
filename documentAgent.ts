import { ChatOpenAI, ChatOpenAICallOptions } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { Document } from 'langchain/document';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { FileHandlerService } from './services/fileHandlerService';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Pinecone
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
});

// Initialize Pinecone index name with type checking
const pineconeIndexName = process.env.PINECONE_INDEX_NAME;
if (!pineconeIndexName) {
    throw new Error('PINECONE_INDEX_NAME environment variable is not defined');
}

// Text splitter configuration
const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
});

// Initialize shared ChatOpenAI instance
const sharedChatModel = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0
});

// Create a higher temperature version for more creative responses
const getCreativeChatModel = () => {
    return sharedChatModel.bind({ temperature: 0.7 } as ChatOpenAICallOptions);
};

// Custom tools for document processing
const extractContentTool = new DynamicStructuredTool({
    name: 'extract_content',
    description: 'Extract content from a file using FileHandlerService',
    schema: z.object({
        filePath: z.string()
    }),
    func: async ({ filePath }) => {
        const content = await FileHandlerService.extractContent(filePath);
        return content;
    }
});

const splitTextTool = new DynamicStructuredTool({
    name: 'split_text',
    description: 'Split text content into chunks',
    schema: z.object({
        content: z.string()
    }),
    func: async ({ content }) => {
        const chunks = await textSplitter.splitText(content);
        return JSON.stringify(chunks);
    }
});

const saveToPineconeTool = new DynamicStructuredTool({
    name: 'save_to_pinecone',
    description: 'Save content chunks to Pinecone vector store',
    schema: z.object({
        chunks: z.array(z.string()),
        documentId: z.string(),
        metadata: z.record(z.any()).optional()
    }),
    func: async ({ chunks, documentId, metadata = {} }) => {
        const index = pinecone.Index(pineconeIndexName);
        const embeddings = new OpenAIEmbeddings();
        const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index
        });

        const documents = chunks.map((chunk, index) => {
            return new Document({
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
const queryPineconeTool = new DynamicStructuredTool({
    name: 'query_pinecone',
    description: 'Query Pinecone vector store for relevant content',
    schema: z.object({
        query: z.string(),
        documentId: z.string()
    }),
    func: async ({ query, documentId }) => {
        const index = pinecone.Index(pineconeIndexName);
        const embeddings = new OpenAIEmbeddings();
        const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
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

// Add new direct chat tool
const directChatTool = new DynamicStructuredTool({
    name: 'direct_chat',
    description: 'Have a direct conversation with ChatGPT without using document context',
    schema: z.object({
        query: z.string()
    }),
    func: async ({ query }) => {
        const chatModel = getCreativeChatModel();

        const response = await chatModel.invoke([
            new SystemMessage(`You are a helpful AI assistant. Provide clear, informative, and engaging responses.
Your responses should be:
1. Accurate and well-reasoned
2. Easy to understand
3. Helpful and practical
4. Engaging but professional`),
            new HumanMessage(query)
        ]);

        return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    }
});

// Update tool sets
const processingTools = [extractContentTool, splitTextTool, saveToPineconeTool];
const queryingTools = [queryPineconeTool, directChatTool];

// Create processing model and tool node
const processingModel = sharedChatModel.bindTools(processingTools);

const processingToolNode = new ToolNode(processingTools);

// Create querying model and tool node
const queryingModel = sharedChatModel.bindTools(queryingTools);

const queryingToolNode = new ToolNode(queryingTools);

// Define the function that determines whether to continue or not
function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.additional_kwargs.tool_calls) {
        return 'tools';
    }
    return '__end__';
}

// Define the model calling functions
async function callProcessingModel(state: typeof MessagesAnnotation.State) {
    const response = await processingModel.invoke(state.messages);
    return { messages: [response] };
}

async function callQueryingModel(state: typeof MessagesAnnotation.State) {
    const response = await queryingModel.invoke(state.messages);
    return { messages: [response] };
}

// Create the processing workflow
const processingWorkflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', callProcessingModel)
    .addEdge('__start__', 'agent')
    .addNode('tools', processingToolNode)
    .addEdge('tools', 'agent')
    .addConditionalEdges('agent', shouldContinue);

// Create the querying workflow
const queryingWorkflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', callQueryingModel)
    .addEdge('__start__', 'agent')
    .addNode('tools', queryingToolNode)
    .addEdge('tools', 'agent')
    .addConditionalEdges('agent', shouldContinue);

// Compile the workflows
const processingApp = processingWorkflow.compile();
const queryingApp = queryingWorkflow.compile();

// Helper function for retrying operations
async function retryWithExponentialBackoff<T>(operation: () => Promise<T>, maxRetries: number = 5, initialDelay: number = 1000): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await operation();
            if (Array.isArray(result) && result.length === 0 && i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                console.log(`No results found in Pinecone yet, retrying... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }
            return result;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            const delay = initialDelay * Math.pow(2, i);
            console.log(`Error occurred, retrying... (Attempt ${i + 1}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error('Max retries reached');
}

// Main processing function
export async function processDocument(filePath: string, existingDocumentId?: string): Promise<{ status: string; message: string; documentId: string }> {
    try {
        const documentId = existingDocumentId || `doc_${Math.random().toString(36).substring(7)}`;
        console.log('Processing document:', filePath, 'with ID:', documentId);

        const systemPrompt = `You are a document processing assistant. Process the document by:
1. Extracting content from the file
2. Splitting the content into chunks
3. Saving the chunks to Pinecone with proper metadata
Use the available tools in sequence to accomplish this task.`;

        const result = await processingApp.invoke({
            messages: [new SystemMessage(systemPrompt), new HumanMessage(`Process this document: ${filePath} with documentId: ${documentId}`)]
        });

        const lastMessage = result.messages[result.messages.length - 1];
        const message = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);

        return {
            status: 'success',
            message,
            documentId
        };
    } catch (error) {
        console.error('Error processing document:', error);
        throw error;
    }
}

// Update the main querying function
export async function queryDocument(query: string, documentId?: string): Promise<{ status: string; message: string }> {
    try {
        console.log(documentId ? `Querying document: ${documentId} with query: ${query}` : `Direct chat query: ${query}`);

        const systemPrompt = documentId
            ? `You are a document querying assistant. Your task is to:
1. Search the document for relevant content using the provided query
2. Analyze the search results
3. Provide a clear, concise response that directly addresses the query
Use the available tools to accomplish this task.`
            : `You are a helpful AI assistant. Your task is to:
1. Understand the user's query
2. Use the direct chat tool to provide a comprehensive response
3. Ensure the response is clear, informative, and directly addresses the query
Use the direct_chat tool to provide your response.`;

        const userMessage = documentId ? `Find information about: "${query}" in document: ${documentId}` : `Please respond to this query: "${query}"`;

        const result = await queryingApp.invoke({
            messages: [new SystemMessage(systemPrompt), new HumanMessage(userMessage)]
        });

        const lastMessage = result.messages[result.messages.length - 1];
        const message = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);

        return {
            status: 'success',
            message
        };
    } catch (error) {
        console.error('Error in query:', error);
        throw error;
    }
}

// Update the chatWithContext function
export async function chatWithContext(query: string, filePaths?: string[]): Promise<{ status: string; message: string }> {
    try {
        // Validate input parameters
        if (!query) {
            return {
                status: 'error',
                message: 'Query is required'
            };
        }

        // Ensure filePaths is always an array
        const paths = filePaths || [];

        // If filePaths is empty, use direct chat with OpenAI
        if (paths.length === 0) {
            console.log('Direct chat query:', query);

            // Get response directly from the model
            const chatModel = getCreativeChatModel();
            const response = await chatModel.invoke([
                new SystemMessage(`You are a helpful AI assistant. Provide clear, informative, and engaging responses.
Your responses should be:
1. Accurate and well-reasoned
2. Easy to understand
3. Helpful and practical
4. Engaging but professional`),
                new HumanMessage(query)
            ]);

            const message = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

            return {
                status: 'success',
                message
            };
        }

        // If filePaths is not empty, process documents and query them
        // Process each file and collect their documentIds
        const documentIds = await Promise.all(
            paths.map(async (filePath) => {
                const result = await processDocument(filePath);
                return result.documentId;
            })
        );

        // Query all processed documents
        const results = await Promise.all(
            documentIds.map(async (documentId) => {
                const result = await queryDocument(query, documentId);
                return result.message;
            })
        );

        // Combine and return results
        return {
            status: 'success',
            message: results.join('\n\n')
        };
    } catch (error) {
        console.error('Error in chat with context:', error);
        // Return a more user-friendly error message
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'An unexpected error occurred'
        };
    }
}
