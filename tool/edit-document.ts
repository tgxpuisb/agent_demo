import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';
import { getReadDocumentResponse } from '@/tool/read-document-response';
import { google } from '@ai-sdk/google';
import { weatherAgent } from '@/agent/weather-agent';

/** 文档编辑执行工具 - 根据 learnSkills 生成的规划执行编辑 */
export const editDocumentTool = tool({
  description: 'Execute document edits based on the plan from learnSkillsTool',
  inputSchema: z.object({
    requestId: z.string(), // 原始文档内容
  }),
  async *execute({ requestId }: { requestId: string }) {
    console.log('AAA editDocumentTool in');
    console.log('AAA editDocumentTool in', requestId);
    const readDocumentResponse = await getReadDocumentResponse(requestId);

    if (!readDocumentResponse) {
      console.log('AAA editDocumentTool error', `No read document response found for requestId: ${requestId}`);
      yield {
        state: 'error' as const,
        value: { message: `No read document response found for requestId: ${requestId}` },
      };
      return;
    }

        /** 2️⃣ 构造给 AI 的 Prompt（这是关键） */
    const prompt = `
      You are a professional document editor.

      USER INSTRUCTION:
      ${readDocumentResponse.message}

      DOCUMENT CONTENT:
      ${readDocumentResponse.documentContent}

      RULES:
      - Modify the document strictly according to the user's instruction.
      - Preserve unrelated content.
      - Keep formatting logical and professional.
      - Return the FULL updated document content.
      - Do NOT explain the changes.
      - Do NOT include markdown fences.
      - Do NOT include comments.
      `;
        
    yield { state: 'loading' as const };

    // 模拟编辑执行（实际替换为真实的文档修改逻辑）
    await new Promise(resolve => setTimeout(resolve, 3000));

    yield {
      state: 'ready' as const,
      value: {
        message: `Document edited successfully.`,
      },
    };
  },
});

export type EditDocumentUIToolInvocation = UIToolInvocation<typeof editDocumentTool>;