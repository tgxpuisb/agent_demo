import { google } from '@ai-sdk/google';
import {
  Experimental_Agent as Agent,
  Experimental_InferAgentUIMessage as InferAgentUIMessage,
  stepCountIs,
} from 'ai';

import { readDocumentTool } from '@/tool/read-document';
import { learnSkillsTool } from '@/tool/learn-skills';
import { editDocumentTool } from '@/tool/edit-document';

export const weatherAgent = new Agent({
  model: google('gemini-2.5-pro'),

  system: `
You are a professional Word document editing agent.

You MUST follow this loop strictly:

1. Call readDocumentTool
2. Call learnSkillsTool
3. Call editDocumentTool
4. END immediately after editDocumentTool completes.

Rules:
- You MUST call each tool AT MOST ONCE.
- After editDocumentTool, you MUST NOT perform any further reasoning,
  inspection, validation, or additional edits.
- You MUST NOT call editDocumentTool more than once.
- Tools NEVER call each other.
- editDocumentTool is a pure executor.
- You MUST generate tool calls as structured JSON.
- You MUST stream tool-input-delta when generating edits.

Do NOT loop.
Do NOT self-correct.
Do NOT attempt a second edit.
`,

  tools: {
    readDocument: readDocumentTool,
    learnSkills: learnSkillsTool,
    editDocument: editDocumentTool,
  },

  stopWhen: stepCountIs(10),
});

export type WeatherAgentUIMessage = InferAgentUIMessage<typeof weatherAgent>;
