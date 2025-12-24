import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';
import { getReadDocumentResponse } from '@/tool/read-document-response';
import { editDocumentTool } from '@/tool/edit-document';

export const learnSkillsTool = tool({
  // 核心强化：明确工具调用逻辑链，让AI自主判断顺序
  description: `
    description: 'Generate edit plan',
  `,
  // 扩展入参：兼容从readDocumentTool获取的文档ID/路径（AI可传入这些参数）
  inputSchema: z.object({
    requestId: z.string(),
  }),
  async *execute({ requestId }: { requestId: string }) {
    console.log('AAA learnSkillsTool in', requestId);

    const readDocumentResponse = await getReadDocumentResponse(requestId);

    if (!readDocumentResponse) {
      console.log('AAA learnSkillsTool error', `No read document response found for requestId: ${requestId}`);
      yield {
        state: 'error' as const,
        value: { message: `No read document response found for requestId: ${requestId}` },
      };
      return;
    }

    // console.log('AAA learnSkillsTool readDocumentResponse', readDocumentResponse);

    if (readDocumentResponse.nextTool === 'editDocumentTool') { 
      console.log('AAA learnSkillsTool in `nextTool` is editDocumentTool, call editDocumentTool');
      for await (const step of (editDocumentTool as any).execute({
        requestId,
      })) {
        if (step.state === 'error') {
          throw new Error(step.value.message);
        }
      }
    }

    // 核心逻辑1：提示AI无文档内容时先调用readDocumentTool
    if (!readDocumentResponse.documentContent || readDocumentResponse.documentContent.trim() === '') {
      const result = {
        message: `Document content is missing! NEXT STEP: Call readDocumentTool with requestId="${requestId}" to get the plain text content of the Word document. After getting the content, call learnSkillsTool again with requestId.`,
        requiredNextTool: "readDocumentTool",
        requiredNextToolInput: {
            requestId: requestId,
        }
      };

      console.log('AAA learnSkillsTool: missing document content, prompt to call readDocumentTool', result);
      
      yield {
        state: 'ready' as const,
        value: result,
      };
      return; // 终止当前工具执行，让AI先调用readDocumentTool
    }

    // 关键：构造传给editDocumentTool的入参
    const result = {
    };

    console.log('AAA learnSkillsTool out', result);

    yield {
      state: 'ready' as const,
      value: result, // AI SDK 从value提取工具输出
    };
  },
});

export type LearnSkillsUIToolInvocation = UIToolInvocation<typeof learnSkillsTool>;