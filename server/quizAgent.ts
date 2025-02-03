import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Pinecone
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
});

// Define the quiz question schema
const quizQuestionSchema = z.object({
    question: z.string(),
    options: z.object({
        A: z.string(),
        B: z.string(),
        C: z.string(),
        D: z.string()
    }),
    correctAnswer: z.enum(['A', 'B', 'C', 'D']),
    explanation: z.string()
});

const quizSchema = z.array(quizQuestionSchema);

// Update the system prompt to be more explicit about JSON formatting
const SYSTEM_PROMPT = `You are a quiz generator that creates multiple choice questions. 
You must ALWAYS respond with ONLY a valid JSON array of exactly 2 questions, with no additional text or formatting.
Each question must have these exact fields:
- question: string
- options: object with A, B, C, D keys and string values
- correctAnswer: string (must be "A", "B", "C", or "D")
- explanation: string

Example format:
[
    {
        "question": "What is...",
        "options": {
            "A": "First option",
            "B": "Second option",
            "C": "Third option",
            "D": "Fourth option"
        },
        "correctAnswer": "A",
        "explanation": "This is correct because..."
    }
]

IMPORTANT: Return ONLY the JSON array. Do not include any additional text, markdown formatting, or explanations.`;

// Define fetch document tool
const fetchDocumentContentTool = new DynamicStructuredTool({
    name: 'fetch_document_content',
    description: 'Fetch document content from Pinecone by documentId',
    schema: z.object({
        documentId: z.string()
    }),
    func: async ({ documentId }) => {
        const index = pinecone.Index('study-companion-db');
        const embeddings = new OpenAIEmbeddings();
        const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
            filter: { documentId }
        });
        const results = await vectorStore.similaritySearch('', 10);
        return results.map((doc) => doc.pageContent).join('\n\n');
    }
});

// Define the tools for the agent to use
const tools = [fetchDocumentContentTool];
const toolNode = new ToolNode(tools);

// Create quiz generation model and bind tools
const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.7
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

// Create the workflow
export async function generateQuiz(documentId: string): Promise<any> {
    try {
        // Create the graph
        const workflow = new StateGraph(MessagesAnnotation)
            .addNode('agent', callModel)
            .addEdge('__start__', 'agent')
            .addNode('tools', toolNode)
            .addEdge('tools', 'agent')
            .addConditionalEdges('agent', shouldContinue);

        // Compile the graph
        const app = workflow.compile();

        // Initialize the workflow with the system message and initial query
        const initialMessages = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(
                `Create a quiz with 2 multiple choice questions based on the content from document ID: ${documentId}. Remember to return ONLY the JSON array with no additional text.`
            )
        ];

        // Run the workflow
        const result = await app.invoke({
            messages: initialMessages
        });

        // Parse the final response
        const lastMessage = result.messages[result.messages.length - 1];
        let rawQuiz = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);

        // Clean up the response to ensure valid JSON
        rawQuiz = rawQuiz.trim();
        // Remove any markdown code block markers if present
        rawQuiz = rawQuiz
            .replace(/^```json\s*/, '')
            .replace(/^```\s*/, '')
            .replace(/\s*```$/, '');

        try {
            // Try to parse the JSON
            const parsedQuiz = JSON.parse(rawQuiz);
            // Validate the quiz structure
            const quiz = quizSchema.parse(parsedQuiz);
            return quiz;
        } catch (parseError) {
            console.error('Raw quiz content:', rawQuiz);
            console.error('JSON parsing error:', parseError);
            throw new Error('Failed to parse quiz response. The model returned invalid JSON.');
        }
    } catch (error) {
        console.error('Error in quiz generation:', error);
        throw error;
    }
}
