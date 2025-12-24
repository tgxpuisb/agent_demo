import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';
import { getReadDocumentResponse } from '@/tool/read-document-response';
import { editDocumentTool } from '@/tool/edit-document';

export const learnSkillsTool = tool({
  // 核心强化：明确工具调用逻辑链，让AI自主判断顺序
  description: `
This tool generates an edit / skill plan based on the loaded document.

AFTER this tool finishes:
- Inspect the returned value.
- If value.nextTool is defined:
  - You MUST immediately call the tool named in value.nextTool.
  - Use value.nextToolInput as the tool input.
- If value.nextTool is empty or undefined:
  - You MUST stop and finish the process.

You MUST NOT respond to the user.
You MUST NOT summarize.
You MUST NOT perform any other action.
`,
  // description: `
  //   description: 'Generate edit plan',
  // `,
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

    // if (readDocumentResponse.nextTool === 'editDocumentTool') { 
    //   console.log('AAA learnSkillsTool in `nextTool` is editDocumentTool, call editDocumentTool 123');
    //   for await (const step of (editDocumentTool as any).execute({
    //     requestId,
    //   })) {
    //     if (step.state === 'error') {
    //       throw new Error(step.value.message);
    //     }
    //   }
    //   const response = {
    //     requestId: requestId,
    //     note: `Learn skills successfully. NEXT STEP: Call editDocumentTool with requestId.`,
    //     recommendedNextTool: 'editDocumentTool',
    //     requiredNextTool: 'editDocumentTool',
    //     nextToolInput: {
    //       requestId: requestId,
    //     },  
    //   };
    //   console.log('CCCCCCCC', response);
    //   yield {
    //     state: 'ready' as const,
    //     value: response,
    //   };
    //   return;
    // }

    console.log('DDDDDDDDDDD');

    // call editDocumentTool
    // if (readDocumentResponse.nextTool === 'editDocumentTool') {
    //   console.log('AAA learnSkillsTool in `nextTool` is editDocumentTool, call editDocumentTool 123');
    //   const result = {
    //     note: `Learn skills successfully. NEXT STEP: Call editDocumentTool with requestId.`,
    //     requiredNextTool: "editDocumentTool",
    //     requiredNextToolInput: {
    //         requestId: requestId,
    //     }
    //   };

    //   console.log('AAA learnSkillsTool: missing document content, prompt to call readDocumentTool456', result);
      
    //   yield {
    //     state: 'ready' as const,
    //     value: result,
    //   };
    // }

    // 关键：构造传给editDocumentTool的入参
    const result = {
      requestId: requestId,
      note: `Learn skills successfully. NEXT STEP: Call editDocumentTool with requestId.`,
      recommendedNextTool: 'editDocumentTool',
      requiredNextTool: 'editDocumentTool',
      nextTool: 'editDocumentTool',
      nextToolInput: {
        requestId: requestId,
      },
    };

    console.log('AAA learnSkillsTool out', result);

    yield {
      state: 'ready' as const,
      value: result, // AI SDK 从value提取工具输出
    };
  },
});

export type LearnSkillsUIToolInvocation = UIToolInvocation<typeof learnSkillsTool>;