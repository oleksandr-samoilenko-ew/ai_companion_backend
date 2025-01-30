import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { Document } from 'langchain/document';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Pinecone
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

// Custom tools for the quiz agent
const fetchDocumentContentTool = new DynamicStructuredTool({
    name: 'fetch_document_content',
    description: 'Fetch document content from Pinecone by documentId',
    schema: z.object({
        documentId: z.string(),
    }),
    func: async ({ documentId }) => {
        const index = pinecone.Index('study-companion-db');
        const embeddings = new OpenAIEmbeddings();
        const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
            filter: { documentId },
        });

        const results = await vectorStore.similaritySearch('', 10); // Fetch up to 10 chunks
        return JSON.stringify(results);
    },
});

const generateQuizTool = new DynamicStructuredTool({
    name: 'generate_quiz',
    description: 'Generate a quiz based on document content',
    schema: z.object({
        content: z.string(),
    }),
    func: async ({ content }) => {
        const model = new ChatOpenAI({
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

const evaluateAnswersTool = new DynamicStructuredTool({
    name: 'evaluate_answers',
    description: 'Evaluate user answers against correct answers',
    schema: z.object({
        quiz: z.string(),
        userAnswers: z.string(),
    }),
    func: async ({ quiz, userAnswers }) => {
        const quizData = JSON.parse(quiz);
        const userAnswersData = JSON.parse(userAnswers);

        const results = quizData.map((question: any, index: number) => {
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

        const totalCorrect = results.filter((r: any) => r.isCorrect).length;
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
const toolNode = new ToolNode(tools);

// Create a model and give it access to the tools
const model = new ChatOpenAI({
    modelName: 'gpt-4',
    temperature: 0,
}).bindTools(tools);

// Define the function that determines whether to continue or not
function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.additional_kwargs.tool_calls) {
        return 'tools';
    }
    return '__end__';
}

// Define the function that calls the model
async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
}

// Define the graph
const workflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', callModel)
    .addEdge('__start__', 'agent')
    .addNode('tools', toolNode)
    .addEdge('tools', 'agent')
    .addConditionalEdges('agent', shouldContinue);

// Compile the graph into a LangChain Runnable
const app = workflow.compile();

export async function generateQuiz(documentId: string): Promise<any> {
    try {
        // First, fetch the document content
        const content = await fetchDocumentContentTool.func({ documentId });

        // Generate the quiz
        const quiz = await generateQuizTool.func({ content });

        return JSON.parse(quiz);
    } catch (error) {
        console.error('Error generating quiz:', error);
        throw error;
    }
}

export async function evaluateQuiz(
    quiz: any,
    userAnswers: string[]
): Promise<any> {
    try {
        return await evaluateAnswersTool.func({
            quiz: JSON.stringify(quiz),
            userAnswers: JSON.stringify(userAnswers),
        });
    } catch (error) {
        console.error('Error evaluating quiz:', error);
        throw error;
    }
}
