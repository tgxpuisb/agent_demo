import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';
import { streamText } from 'ai';

import { getDocument } from '@/tool/document-store';
import { saveReadDocumentResponse, getReadDocumentResponse } from '@/tool/read-document-response';
import { learnSkillsTool } from '@/tool/learn-skills';

export const readDocumentTool = tool({
  description: `
    This tool loads and parses a document.

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
  //   You MUST call learnSkillsTool immediately after this tool.
  //   Do not respond to the user.
  //   Do not summarize.
  //   Only call learnSkillsTool.
  // `,
  inputSchema: z.object({
    requestId: z.string(),
  }),

  async *execute({ requestId }: { requestId: string }) {
    yield { state: 'loading' as const };
    console.log('AAA readDocumentTool in', requestId);

    const documentContext = await getDocument(requestId);

    if (!documentContext) {
      console.log('AAA readDocumentTool error', `No document found for requestId: ${requestId}`);
      yield {
        state: 'error' as const,
        value: { message: `No document found for requestId: ${requestId}` },
      };
      return;
    }

    const wordML = documentContext.ooxml?.body ?? '';

    // 解析纯文本
    const parsedText = wordML
      .replace(/<\/?[a-zA-Z0-9:-]+[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 保存到临时响应存储
    await saveReadDocumentResponse(requestId, {
      documentId: requestId,
      documentContent: documentContext.documentContent ?? '',
      parsedText,
      ooxml: documentContext.ooxml,
      messages: documentContext.messages ?? [],
      message: documentContext.message ?? '',
      nextTool: 'editDocumentTool',
      metadata: {
        selectedText: documentContext.selectedText ?? '',
        styleGuide: documentContext.styleGuide ?? '',
      },
    });
    // if (true) { 
    //   console.log('AAA readDocumentTool find nextTool is learnSkillsTool, call learnSkillsTool 123');
    //   for await (const step of (learnSkillsTool as any).execute({
    //     requestId,
    //   })) {
    //     if (step.state === 'error') {
    //       throw new Error(step.value.message);
    //     }
    //   }

    //   const response = {
    //     requestId: requestId,
    //     note: `Document loaded successfully. NEXT STEP: Call learnSkillsTool with requestId.`,
    //     recommendedNextTool: 'learnSkillsTool',
    //     requiredNextTool: 'learnSkillsTool',
    //     nextToolInput: {
    //       requestId: requestId,
    //     },
    //   };
    //   console.log('BBBBBBBBBBB', response);
    //   yield {
    //     state: 'ready' as const,
    //     value: response,
    //   };
    //   return;
    // }

    console.log('AAAAAAAAAAA');


    // 构造返回值，推荐下一步调用 learnSkillsTool
    const response = {
      requestId: requestId,
      note: `Document loaded successfully. NEXT STEP: Call learnSkillsTool with requestId.`,
      recommendedNextTool: 'learnSkillsTool',
      requiredNextTool: 'learnSkillsTool',
      nextTool: 'learnSkillsTool',
      nextToolInput: {
        requestId: requestId,
      },
    };

    // console.log('AAA readDocumentTool out', response);

    yield {
      state: 'ready' as const,
      value: response,
    };
  },
});

export type ReadDocumentUIToolInvocation = UIToolInvocation<typeof readDocumentTool>;
