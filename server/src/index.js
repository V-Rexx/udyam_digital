import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { llmEnabled } from './advisor/llm.js';

const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/udyam';
await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const port = process.env.PORT ?? 4000;
createApp().listen(port, () => {
  console.log(`Udyam Digital API on http://localhost:${port}`);
  console.log(llmEnabled() ? `Advisor: Gemini (${process.env.GEMINI_MODEL ?? 'gemini-3.8-flash'})` : 'Advisor: scripted fallback. Set GEMINI_API_KEY to turn on the GenAI advisor.');
});
