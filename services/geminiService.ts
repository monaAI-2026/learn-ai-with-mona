/**
 * ⚠️ NOTE: This file is currently NOT USED in the application.
 * The app uses backend API calls (server.js) instead of direct frontend Gemini calls.
 * Kept as reference/backup code for potential future implementation.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { AISummary } from "../types";

const API_KEY = process.env.API_KEY || '';

export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: API_KEY });
};

export const analyzeVideoContent = async (title: string, description: string, transcript: string): Promise<AISummary> => {
  const ai = getGeminiClient();
  const prompt = `
    As an AI learning assistant for non-native English speakers, analyze this video content.
    Title: ${title}
    Description: ${description}
    Transcript/Context: ${transcript}
    
    Provide:
    1. A concise overview (2-3 sentences).
    2. 4-5 key bullet points.
    3. 5 challenging but important vocabulary terms used in this context.
    4. For each term, provide a definition, the context from the text, and a Chinese translation.
    
    Format the response strictly as JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING },
          keyPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                definition: { type: Type.STRING },
                context: { type: Type.STRING },
                chineseTranslation: { type: Type.STRING }
              },
              required: ['term', 'definition', 'context', 'chineseTranslation']
            }
          }
        },
        required: ['overview', 'keyPoints', 'vocabulary']
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}') as AISummary;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Invalid AI response format");
  }
};

export const askVideoQuestion = async (
  question: string, 
  videoTitle: string, 
  transcript: string,
  chatHistory: { role: 'user' | 'model', parts: { text: string }[] }[]
) => {
  const ai = getGeminiClient();
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are a helpful AI teacher assisting a non-native English speaker. The context is a video titled "${videoTitle}". 
      Here is the transcript/summary: ${transcript}. 
      Keep your answers helpful, encourage the student, and use relatively simple English while explaining complex AI terms. 
      If asked for translation, provide it in Chinese.`
    }
  });

  // Reconstruct chat history
  const response = await chat.sendMessage({ message: question });
  return response.text;
};
