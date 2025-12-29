import { GoogleGenAI } from '@google/genai';
import type { ComponentData } from './supabaseService';

const genAI = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export interface VideoScript {
  title: string;
  duration: number;
  scenes: Scene[];
  voiceover: string;
  prompt: string;
}

export interface Scene {
  timeStart: number;
  timeEnd: number;
  visual: string;
  text: string;
}

export async function generateVideoScript(
  themeName: string,
  themeDescription: string,
  components: ComponentData[],
  durationSeconds: number = 8
): Promise<VideoScript> {

  const componentList = components
    .map(c => `- ${c.name}: ${c.content}`)
    .join('\n');

  const systemPrompt = `
You are a senior pharmaceutical video ad director and medical copywriter.
You create cinematic, compliant, single-shot pharmaceutical video scripts.
You ALWAYS return valid JSON only.
`;

  const userPrompt = `
Create a concise, high-end ${durationSeconds}-second pharmaceutical video script.

THEME: ${themeName}
DESCRIPTION: ${themeDescription}

COMPONENTS TO INCORPORATE:
${componentList}

MANDATORY RULES:
- EXACT duration: ${durationSeconds} seconds
- ONE continuous shot (no cuts, no scene changes)
- Professional pharmaceutical commercial tone
- Non-anatomical medical metaphors only
- Indian patient if a patient is shown
- No exaggerated or unsafe medical claims

Return JSON in EXACTLY this schema:
{
  "title": string,
  "duration": number,
  "scenes": [
    {
      "timeStart": number,
      "timeEnd": number,
      "visual": string,
      "text": string
    }
  ],
  "voiceover": string,
  "prompt": string
}

IMPORTANT:
- "prompt" MUST be a single, Veo-ready cinematic prompt
- Include second-by-second timing
- Specify camera movement, lighting, visual metaphors
- Clearly include brand name if present in components
- The full video MUST fit exactly in ${durationSeconds} seconds
`;

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { role: 'system', parts: [{ text: systemPrompt }] },
      { role: 'user', parts: [{ text: userPrompt }] },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  return JSON.parse(response.text!) as VideoScript;
}
