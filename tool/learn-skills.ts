import { tool, UIToolInvocation } from 'ai';
import { z } from 'zod';
import { getReadDocumentResponse } from '@/tool/read-document-response';

export const learnSkillsTool = tool({
  description: `
Analyze document paragraphs and GENERATE an edit plan.

You MUST:
- Output a JSON object with { des, edits }
- edits[].v.xml MUST be full <w:p> XML
- Stream your generation (tool-input-delta is expected)
`,

  inputSchema: z.object({
    requestId: z.string(),
  }),

  async *execute({ requestId }) {
    console.log('AAA learnSkillsTool in', requestId);
    const data = await getReadDocumentResponse(requestId);
    if (!data?.metadata?.relevantParagraphs) {
      yield { state: 'error' as const, value: { message: 'No paragraphs' } };
      return;
    }

    // ⚠️ 关键点：这里什么都不“算”
    // 只是把真实文档上下文交给模型
    yield {
      state: 'ready' as const,
      value: {
instruction: `
Generate edit instructions as JSON.

Schema:
{
  "des": string,
  "requestId": string,
  "edits": Array<{
    "t": "p",
    "v": {
      "o": "delete" | "replace" | "before" | "after",
      "i": number,
      "xml"?: string   // REQUIRED for replace/before/after, OMIT for delete
    }
  }>
}

Rules:
- If o = "delete", DO NOT include xml
- If o ≠ "delete", xml MUST be a full <w:p>...</w:p> paragraph
- Output JSON ONLY


Paragraphs:
${data.metadata.relevantParagraphs.map((p: string, i: number) => `p${i}: ${p}`).join('\n')}
`,
      },
    };
  },
});

export type LearnSkillsInvocation = UIToolInvocation<typeof learnSkillsTool>;
