"use strict";
// import { ChatOpenAI } from '@langchain/openai';
// import { HumanMessage } from '@langchain/core/messages';
// import { ToolNode } from '@langchain/langgraph/prebuilt';
// import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
// import { Document } from 'langchain/document';
// import { PineconeStore } from '@langchain/pinecone';
// import { Pinecone } from '@pinecone-database/pinecone';
// import { OpenAIEmbeddings } from '@langchain/openai';
// import * as path from 'path';
// import { DynamicStructuredTool } from '@langchain/core/tools';
// import { z } from 'zod';
// import { getTopCourses } from './summarizeAgent';
Object.defineProperty(exports, "__esModule", { value: true });
// import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
// import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
// import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
// import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
// import dotenv from 'dotenv';
// import { FileHandlerService } from './services/fileHandlerService';
// // import pdf from 'pdf-parse';
// dotenv.config();
// // Initialize Pinecone
// const pinecone = new Pinecone({
//     apiKey: process.env.PINECONE_API_KEY!
// });
// // Custom tools for file parsing and Pinecone storage
// const parseFileTool = new DynamicStructuredTool({
//     name: 'parse_file',
//     description: 'Parse PDF, DOCX, or CSV file',
//     schema: z.object({
//         filePath: z.string()
//     }),
//     func: async ({ filePath }) => {
//         const fileExtension = path.extname(filePath).toLowerCase();
//         const loader = _getLoaderForFileType(fileExtension, filePath);
//         const documents = await loader.load();
//         return documents;
//     }
// });
// function _getLoaderForFileType(fileExtension: string, filePath: string) {
//     switch (fileExtension) {
//         case '.pdf':
//             return new PDFLoader(filePath, { splitPages: false });
//         case '.docx':
//             return new DocxLoader(filePath);
//         case '.csv':
//             return new CSVLoader(filePath);
//         default:
//             throw new Error(`Unsupported file type: ${fileExtension}`);
//     }
// }
// const saveToPineconeTool = new DynamicStructuredTool({
//     name: 'save_to_pinecone',
//     description: 'Save parsed content to Pinecone vector store',
//     schema: z.object({
//         content: z.string(),
//         metadata: z.record(z.any())
//     }),
//     func: async ({ content, metadata }) => {
//         const index = pinecone.Index('study-companion-db');
//         const vectorStore = await PineconeStore.fromExistingIndex(new OpenAIEmbeddings(), { pineconeIndex: index });
//         const doc = new Document({ pageContent: content, metadata });
//         await vectorStore.addDocuments([doc]);
//         return 'Content saved to Pinecone successfully';
//     }
// });
// // Define the tools for the agent to use
// const tools = [parseFileTool, saveToPineconeTool];
// const toolNode = new ToolNode(tools);
// // Create a model and give it access to the tools
// const model = new ChatOpenAI({
//     modelName: 'gpt-4',
//     temperature: 0
// }).bindTools(tools);
// // Define the function that determines whether to continue or not
// function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
//     const lastMessage = messages[messages.length - 1];
//     if (lastMessage.additional_kwargs.tool_calls) {
//         return 'tools';
//     }
//     return '__end__';
// }
// // Define the function that calls the model
// async function callModel(state: typeof MessagesAnnotation.State) {
//     const response = await model.invoke(state.messages);
//     return { messages: [response] };
// }
// // Define a new graph
// const workflow = new StateGraph(MessagesAnnotation)
//     .addNode('agent', callModel)
//     .addEdge('__start__', 'agent')
//     .addNode('tools', toolNode)
//     .addEdge('tools', 'agent')
//     .addConditionalEdges('agent', shouldContinue);
// // Compile the graph into a LangChain Runnable
// const app = workflow.compile();
// const textSplitter = new RecursiveCharacterTextSplitter({
//     chunkSize: 1000,
//     chunkOverlap: 200
// });
// interface Course {
//     content: string;
//     score: number;
//     title?: string;
//     url?: string;
// }
// interface PineconeMatch {
//     metadata?: {
//         pageContent?: string;
//         title?: string;
//         url?: string;
//     };
//     score: number;
// }
// export async function runAgent(filePath?: string, query?: string) {
//     try {
//         if (filePath) {
//             // Process and store the document content
//             const index = pinecone.Index('study-companion-db');
//             // Generate a unique ID for this document that doesn't include timestamp
//             const documentId = `doc_${Math.random().toString(36).substring(7)}`;
//             console.log('Generated document ID:', documentId);
//             // Get the file content using FileHandlerService
//             const fileContent = await FileHandlerService.extractContent(filePath);
//             console.log('Extracted content length:', fileContent.length);
//             // Split the content into chunks
//             const chunks = await textSplitter.splitText(fileContent);
//             console.log('Number of chunks created:', chunks.length);
//             // Prepare vectors for Pinecone
//             const documents = chunks.map((chunk, index) => {
//                 const metadata = {
//                     documentId: documentId,
//                     filePath: filePath,
//                     chunkIndex: index,
//                     contentLength: chunk.length,
//                     pageContent: chunk
//                 };
//                 console.log(`Chunk ${index} metadata:`, metadata);
//                 return new Document({
//                     pageContent: chunk,
//                     metadata: metadata
//                 });
//             });
//             // Add documents to vector store
//             console.log('Storing documents in Pinecone...');
//             const embeddings = new OpenAIEmbeddings();
//             const vectorStore = await PineconeStore.fromExistingIndex(embeddings, { pineconeIndex: index });
//             // Log the first document's embedding for debugging
//             const firstEmbedding = await embeddings.embedQuery(documents[0].pageContent);
//             console.log('Sample embedding dimension:', firstEmbedding.length);
//             // Delete existing vectors for this file path if they exist
//             try {
//                 const existingVectors = await index.query({
//                     vector: firstEmbedding,
//                     topK: 10000,
//                     filter: {
//                         filePath: filePath
//                     }
//                 });
//                 if (existingVectors.matches.length > 0) {
//                     const ids = existingVectors.matches.map((match) => match.id);
//                     await index.deleteMany(ids);
//                     console.log(`Deleted ${ids.length} existing vectors for this file`);
//                 }
//             } catch (error) {
//                 console.log('No existing vectors found or error deleting:', error);
//             }
//             await vectorStore.addDocuments(documents);
//             console.log('Successfully stored documents in Pinecone');
//             // Call getTopCourses after storing documents with isDocumentId=true
//             // const coursesResult = await getTopCourses('test');
//             // console.log('Top courses result:', coursesResult);
//             return {
//                 status: 'success',
//                 message: 'Document processed and stored successfully',
//                 documentId: documentId,
//                 chunkCount: chunks.length
//                 // courses: coursesResult
//             };
//         }
//         if (query) {
//             const index = pinecone.Index('study-companion-db');
//             const result = await getTopCourses('give a brief summary of the content ');
//             console.log('pinecone result', result);
//             return {
//                 status: 'success',
//                 message: result
//             };
//         }
//         return {
//             status: 'error',
//             message: 'No file or query provided'
//         };
//     } catch (error) {
//         console.error('Error in runAgent:', error);
//         throw error;
//     }
// }
