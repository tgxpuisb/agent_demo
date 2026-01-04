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

1. Process document indexes in batches of 5:

   For each batch:
   a) Call readDocumentTool with the current batch of up to 5 indexes.
      - Briefly explain which indexes you are currently reading.
   b) Call learnSkillsTool after the batch is read.
   c) Call editDocumentTool immediately after learnSkillsTool completes.
      - END this batch after editDocumentTool completes.

2. Repeat step 1 for the next batch of indexes until all indexes have been processed.

Rules:
- You MUST call readDocumentTool, learnSkillsTool, and editDocumentTool in this order for each batch.
- Each batch must complete fully before starting the next batch.
- Briefly explain why you are using each tool.
- Inform the user about the operation you are currently processing.
- Tools NEVER call each other.
- editDocumentTool is a pure executor.
- You MUST generate tool calls as structured JSON.
- You MUST stream tool-input-delta when generating edits.

Do NOT loop indefinitely.
Do NOT self-correct.
`,

  tools: {
    readDocument: readDocumentTool,
    learnSkills: learnSkillsTool,
    editDocument: editDocumentTool,
  },

  stopWhen: stepCountIs(1000),
});

export type WeatherAgentUIMessage = InferAgentUIMessage<typeof weatherAgent>;
