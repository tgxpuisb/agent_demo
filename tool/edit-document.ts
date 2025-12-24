import { UIToolInvocation, tool, streamText } from 'ai';
import { z } from 'zod';
import { getReadDocumentResponse } from '@/tool/read-document-response';
import { google } from '@ai-sdk/google';
import { weatherAgent } from '@/agent/weather-agent';
import { generateText } from 'ai';

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

    // 3. 告知工具正在加载
    yield { state: 'loading' as const, value: { message: 'Starting document edit...' } };

    // console.log('AAA editDocumentTool readDocumentResponse', readDocumentResponse);

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
    
    console.log('AAA prompt', prompt);
        
      /** 4. 纯 SDK 调用 Gemini API（核心修复：用 generateText 替代 streamText） */
      const result = await generateText({
        model: google('gemini-2.5-pro'), // 指定强模型
        prompt: prompt,
        // 精准配置模型参数（杜绝脑补）
        temperature: 0.0, // 0 = 完全确定性输出，无任何脑补
        topP: 0.9,
        topK: 1, // 仅选概率最高的输出，避免发散
        // 强制模型遵守指令的系统提示（AI v5 支持）
      });

      // 5. 

    // 收集模型返回的编辑后内容
    let editedContent = result.text;

    console.log('AAA editedContent', editedContent);

    // 模拟编辑执行（实际替换为真实的文档修改逻辑）
    // await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. 返回真实编辑结果
      yield {
        state: 'ready' as const,
        value: {
          requestId,
          message: 'Document edited successfully.',
          originalContent: readDocumentResponse.documentContent,
          editedContent: editedContent.trim(), // 编辑后的真实内容
          metadata: {
            editInstruction: readDocumentResponse.message,
            styleGuide: readDocumentResponse.metadata?.styleGuide || '',
          },
        },
      };
  },
});

export type EditDocumentUIToolInvocation = UIToolInvocation<typeof editDocumentTool>;