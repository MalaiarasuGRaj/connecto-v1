
'use server';

import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const MessageSchema = z.object({
  message: z.string(),
});

// Function to read all .txt files from the data directory
async function getKnowledgeBase(): Promise<string> {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    const files = await fs.promises.readdir(dataDir);
    const txtFiles = files.filter((file) => path.extname(file) === '.txt');
    const fileContents = await Promise.all(
      txtFiles.map((file) => fs.promises.readFile(path.join(dataDir, file), 'utf-8'))
    );
    return fileContents.join('\n\n---\n\n');
  } catch (error) {
    console.error('Error reading knowledge base:', error);
    // If the directory doesn't exist or there are other errors, return an empty string.
    return '';
  }
}

export async function getResponse(input: { message: string }) {
  const validatedInput = MessageSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new Error('Invalid input');
  }

  try {
    const knowledge = await getKnowledgeBase();
    const userMessage = validatedInput.data.message;

    const systemPrompt = `You are a helpful chatbot. Use the following information from the knowledge base to answer the user's question. If the information isn't in the knowledge base, say that you don't have that information.

Knowledge Base:
---
${knowledge}
---
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "model": "google/gemini-flash-1.5",
        "messages": [
          { "role": "system", "content": systemPrompt },
          { "role": "user", "content": userMessage }
        ]
      })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('OpenRouter API error:', errorBody);
        throw new Error(`OpenRouter API request failed with status ${response.status}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse.choices[0].message.content;

  } catch (error) {
    console.error('Error getting response from OpenRouter:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}
