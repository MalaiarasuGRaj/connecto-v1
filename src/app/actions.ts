
'use server';

import { generateGeminiResponse } from '@/ai/flows/generate-response';
import { z } from 'zod';

const MessageSchema = z.object({
  message: z.string(),
});

export async function getResponse(input: { message: string }) {
  const validatedInput = MessageSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new Error('Invalid input');
  }

  try {
    const result = await generateGeminiResponse(validatedInput.data);
    return result.response;
  } catch (error) {
    console.error('Error getting response from Gemini:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}
