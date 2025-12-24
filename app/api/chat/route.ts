import { weatherAgent } from '@/agent/weather-agent';
import { validateUIMessages, UIMessage, InferUITools } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { saveDocument } from '@/tool/document-store';
import { DocumentFlowState } from '@/tool/workflow';
import { runDocumentFSM } from '@/tool/workflow';
import { toolRunner } from '@/tool/tool-runner';
// 工具函数：转义XML特殊字符（工具内部处理，避免Agent解析异常）
const escapeSpecialChars = (str: string) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\t/g, ' ')
    .replace(/\n+/g, '\n');
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('✅ 接收请求（含完整文档内容）');

    // 1. 解构参数（拿到完整的文档内容，无需存储）
    const {
      documentContext = {}, // 已包含所有文档内容（content/styleGuide/ooxml）
      selectedContext = {},
      enabledTools = { webSearch: false, isAgentMode: true },
      message = '',
      messages = [], // 用户编辑指令
    } = body;

    // console.log('AAAAA chat route documentContext', documentContext);

    // 2. 生成临时请求ID（仅用于工具调用时关联当前请求的文档，无存储）
    const requestId = uuidv4();

    saveDocument(requestId, {
      ...documentContext,
      message: message,
    });

    // 3. 构造Agent消息（仅传指令+请求ID，不传文档内容）
    const messagesWithContext = [
        {
        role: 'system',
        id: uuidv4(),
          parts: [
            {
              type: 'text',
              text: `
  You MUST call readDocumentTool FIRST.

  When calling readDocumentTool:
  - Use requestId: ${requestId}
  - Do NOT ask the user for document content
              `.trim(),
            },
          ],
        },
      // 用户消息：仅传编辑指令（纯指令，无文档）
      ...messages.map((msg: any) => ({
        ...msg,
        parts: msg.parts.map((part: any) => ({
          ...part,
          text: part.text.trim(),
        })),
      })),
    ];

    // 4. 验证消息格式
    const validatedMessages = await validateUIMessages({
      messages: messagesWithContext,
    });

    console.log('AAAAA validatedMessages', validatedMessages);

    // const fsmContext = {
    //   requestId: requestId,
    //   nextTool: '',
    //   state: DocumentFlowState.INIT,
    // };

    // const result = await runDocumentFSM(  toolRunner, fsmContext);
    // console.log('AAAAA FSM final result:', result);
    // return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });

    // 5. 调用Agent（关键：把文档内容挂载到toolContext）
    const agentResponse = await weatherAgent.respond({
      messages: validatedMessages as any, // FIX: bypass type issue with UIMessage generic
    });

    const toolValue = (agentResponse as any)?.toolInvocations?.[0]?.output?.value;
    console.log('AAAAA toolValue', toolValue);


    // console.log('AAAAA agentResponse', agentResponse);
    // console.log('AAAAA agentResponse.value', (agentResponse as any).value);
    // console.log('AAAAA agentResponse.value.requiredNextTool', (agentResponse as any).value.requiredNextTool);
    return agentResponse;

  } catch (error) {
    console.error('❌ Agent调用失败：', error);
    return new Response(
      JSON.stringify({
        code: 500,
        message: 'Internal Server Error',
        detail: process.env.NODE_ENV === 'development' 
          ? (error as Error).message 
          : 'Failed to process document editing',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ------------------------------
// 核心：readDocumentTool 实现（直接读取内存中的文档内容）
// 需注册到 weatherAgent 的 tools 配置中
// ------------------------------
export const readDocumentTool = {
  name: 'readDocumentTool',
  description: 'Read full document content from the current request (no external storage)',
  parameters: {
    type: 'object',
    properties: {
      requestId: { 
        type: 'string', 
        description: 'Unique ID of the current request (to associate document data)' 
      },
    },
    required: ['requestId'],
  },
  // 执行函数：ctx 包含 agent.respond 传入的 toolContext
  execute: async (params: { requestId: string }, ctx: { toolContext: any }) => {
    try {
      // 1. 校验requestId（确保工具调用和当前请求匹配）
      if (params.requestId !== ctx.toolContext.requestId) {
        throw new Error(`Invalid requestId: ${params.requestId} (expected: ${ctx.toolContext.requestId})`);
      }

      // 2. 直接从toolContext读取文档（内存中，无需外部存储）
      const documentContext = ctx.toolContext.documentContext;

      // 3. 返回结构化的文档内容（供Agent编辑使用）
      return {
        success: true,
        data: {
          requestId: params.requestId,
          documentContent: escapeSpecialChars(documentContext.documentContent || ''),
          styleGuide: escapeSpecialChars(documentContext.styleGuide || ''),
          selectedText: escapeSpecialChars(documentContext.selectedText || ''),
          ooxml: documentContext.ooxml || {}, // 已提前清洗
          // 给Agent的友好提示
          note: 'Full document content loaded — proceed with editing as per instructions',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read document: ${(error as Error).message}`,
      };
    }
  },
};