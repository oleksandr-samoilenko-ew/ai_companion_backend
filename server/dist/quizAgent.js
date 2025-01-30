"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQuiz = generateQuiz;
exports.evaluateQuiz = evaluateQuiz;
const openai_1 = require("@langchain/openai");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const langgraph_1 = require("@langchain/langgraph");
const pinecone_1 = require("@langchain/pinecone");
const pinecone_2 = require("@pinecone-database/pinecone");
const openai_2 = require("@langchain/openai");
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize Pinecone
const pinecone = new pinecone_2.Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
// Custom tools for the quiz agent
const fetchDocumentContentTool = new tools_1.DynamicStructuredTool({
    name: 'fetch_document_content',
    description: 'Fetch document content from Pinecone by documentId',
    schema: zod_1.z.object({
        documentId: zod_1.z.string(),
    }),
    func: async ({ documentId }) => {
        const index = pinecone.Index('study-companion-db');
        const embeddings = new openai_2.OpenAIEmbeddings();
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
            filter: { documentId },
        });
        const results = await vectorStore.similaritySearch('', 10); // Fetch up to 10 chunks
        return JSON.stringify(results);
    },
});
const generateQuizTool = new tools_1.DynamicStructuredTool({
    name: 'generate_quiz',
    description: 'Generate a quiz based on document content',
    schema: zod_1.z.object({
        content: zod_1.z.string(),
    }),
    func: async ({ content }) => {
        const model = new openai_1.ChatOpenAI({
            modelName: 'gpt-4',
            temperature: 0.7,
        });
        const prompt = `Based on the following content, generate a quiz with 10 questions. 
        For each question, provide:
        1. The question
        2. Four multiple choice options (A, B, C, D)
        3. The correct answer
        4. A brief explanation of why it's correct

        Format the output as a JSON array of objects, where each object has the following structure:
        {
            "question": "string",
            "options": {
                "A": "string",
                "B": "string",
                "C": "string",
                "D": "string"
            },
            "correctAnswer": "string", // "A", "B", "C", or "D"
            "explanation": "string"
        }

        Content:
        ${content}`;
        const response = await model.invoke(prompt);
        return response.content;
    },
});
const evaluateAnswersTool = new tools_1.DynamicStructuredTool({
    name: 'evaluate_answers',
    description: 'Evaluate user answers against correct answers',
    schema: zod_1.z.object({
        quiz: zod_1.z.string(),
        userAnswers: zod_1.z.string(),
    }),
    func: async ({ quiz, userAnswers }) => {
        const quizData = JSON.parse(quiz);
        const userAnswersData = JSON.parse(userAnswers);
        const results = quizData.map((question, index) => {
            const userAnswer = userAnswersData[index];
            const isCorrect = question.correctAnswer === userAnswer;
            return {
                questionNumber: index + 1,
                userAnswer,
                isCorrect,
                correctAnswer: question.correctAnswer,
                explanation: question.explanation,
            };
        });
        const totalCorrect = results.filter((r) => r.isCorrect).length;
        const score = (totalCorrect / quizData.length) * 100;
        return JSON.stringify({
            score,
            totalCorrect,
            totalQuestions: quizData.length,
            details: results,
        });
    },
});
// Define the tools for the agent
const tools = [fetchDocumentContentTool, generateQuizTool, evaluateAnswersTool];
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
async function generateQuiz(documentId) {
    try {
        // First, fetch the document content
        const content = await fetchDocumentContentTool.func({ documentId });
        // Generate the quiz
        const quiz = await generateQuizTool.func({ content });
        return JSON.parse(quiz);
    }
    catch (error) {
        console.error('Error generating quiz:', error);
        throw error;
    }
}
async function evaluateQuiz(quiz, userAnswers) {
    try {
        return await evaluateAnswersTool.func({
            quiz: JSON.stringify(quiz),
            userAnswers: JSON.stringify(userAnswers),
        });
    }
    catch (error) {
        console.error('Error evaluating quiz:', error);
        throw error;
    }
}
