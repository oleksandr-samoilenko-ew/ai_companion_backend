import express from 'express';
import cors from 'cors';
// ... your other imports

const app = express();
app.use(cors());
app.use(express.json());

// ... your routes and other middleware

// Get the port from the environment variable or use 8080 as fallback
const port = process.env.PORT || 8080;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;
