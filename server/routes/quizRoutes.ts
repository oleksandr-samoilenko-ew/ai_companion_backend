import { Request, Response } from 'express';
import { generateQuiz, evaluateQuiz } from '../quizAgent';

interface QuizRequest {
    documentId: string;
}

interface QuizAnswerRequest {
    documentId: string;
    quizId: string;
    answers: string[]; // Array of answers like ["A", "B", "C", "D"]
}

// Store quizzes in memory (in a production environment, this should be in a database)
const quizzes = new Map<string, any>();

export async function handleQuizGeneration(req: Request, res: Response) {
    try {
        const { documentId } = req.body as QuizRequest;

        if (!documentId) {
            return res.status(400).json({
                status: 'error',
                message: 'documentId is required',
            });
        }

        // Generate quiz
        const quiz = await generateQuiz(documentId);

        // Generate a unique ID for this quiz
        const quizId = `quiz_${Math.random().toString(36).substring(7)}`;

        // Store the quiz
        quizzes.set(quizId, quiz);

        // Remove correct answers and explanations from the response
        const quizForUser = quiz.map((q: any) => ({
            question: q.question,
            options: q.options,
        }));

        res.json({
            status: 'success',
            quizId,
            quiz: quizForUser,
        });
    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({
            status: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Error generating quiz',
        });
    }
}

export async function handleQuizEvaluation(req: Request, res: Response) {
    try {
        const { quizId, answers } = req.body as QuizAnswerRequest;

        if (!quizId || !answers) {
            return res.status(400).json({
                status: 'error',
                message: 'quizId and answers are required',
            });
        }

        // Retrieve the original quiz
        const quiz = quizzes.get(quizId);
        if (!quiz) {
            return res.status(404).json({
                status: 'error',
                message: 'Quiz not found',
            });
        }

        // Evaluate answers
        const evaluation = await evaluateQuiz(quiz, answers);
        const evaluationResult = JSON.parse(evaluation);

        res.json({
            status: 'success',
            ...evaluationResult,
        });
    } catch (error) {
        console.error('Error evaluating quiz:', error);
        res.status(500).json({
            status: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Error evaluating quiz',
        });
    }
}
