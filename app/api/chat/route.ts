import { weatherAgent } from '@/agent/weather-agent';
import { validateUIMessages, UIMessage, InferUITools, streamText } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { saveDocument } from '@/tool/document-store';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

// escape special chars
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

// ------------------------------
// 新增：解析 documentContent（提取总段落数、结构化段落索引+内容）
// 适配格式：DOC: 106p, 0t + p0|... + p1|...
// ------------------------------
interface ParsedDocument {
  totalParagraphs: number; // 总段落数（如 106）
  paragraphs: Array<{ index: number; content: string }>; // 结构化段落（索引+内容）
  rawContent: string; // 原始清洗后内容
}

const parseDocumentContent = (documentContent: string): ParsedDocument => {
  const result: ParsedDocument = {
    totalParagraphs: 0,
    paragraphs: [],
    rawContent: escapeSpecialChars(documentContent || '')
  };

  if (!documentContent) return result;

  const lines = documentContent.split('\n').map(line => line.trim()).filter(line => line);

  // 步骤 1：提取总段落数（匹配 DOC: XXXp 格式）
  const docLine = lines.find(line => line.startsWith('DOC:'));
  if (docLine) {
    const totalMatch = docLine.match(/DOC:\s*(\d+)p/);
    if (totalMatch && totalMatch[1]) {
      result.totalParagraphs = parseInt(totalMatch[1], 10);
    }
  }

  // 步骤 2：提取 p0/p1/... 结构化段落（匹配 pX|... 格式）
  const paragraphRegex = /^p(\d+)\|(.+)$/; // 匹配 pX|内容（X为数字索引）
  lines.forEach(line => {
    const match = line.match(paragraphRegex);
    if (match) {
      const index = parseInt(match[1], 10);
      const content = match[2]; // 保留 | 后面的完整内容（含段落类型+文本）
      result.paragraphs.push({
        index,
        content: escapeSpecialChars(content)
      });
    }
  });

  // 步骤 3：段落按索引排序（确保顺序一致）
  result.paragraphs.sort((a, b) => a.index - b.index);

  return result;
};

// ------------------------------
// 新增：调用 AI 筛选相关段落索引（返回 pIdxs 嵌套数组格式）
// ------------------------------
const getRelevantParagraphIdxs = async (
  parsedDoc: ParsedDocument,
  userMessage: string
): Promise<string> => {
  if (!parsedDoc.paragraphs.length || !userMessage) {
    console.log('❌ 无段落/无用户需求，返回空字符串');
    return ''; // 无段落/无用户需求，返回空数组
  }

  // 构造专属 Prompt：要求 AI 返回嵌套数组格式的段落索引
  const prompt = `
你需要根据用户需求，从以下文档段落中筛选出**相关的段落索引**，并严格按照要求返回结果：

### 文档信息
- 总段落数：${parsedDoc.totalParagraphs}
- 可用段落索引（已排序）：${parsedDoc.paragraphs.map(p => p.index).join(', ')}

### 段落内容预览（索引+核心内容）
${parsedDoc.paragraphs.map(p => `p${p.index}: ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`).join('\n')}

### 用户需求
${userMessage}

### 返回要求（必须严格遵守，否则会报错）
1.  仅返回段落索引的**嵌套数组**，无需任何额外解释、文字描述。
2.  索引必须是文档中存在的非负整数，不得超出总段落数范围。
3.  相关段落可分组用子数组包裹（如 [0,1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21]），无关段落不纳入。
4.  若无相关段落，返回空数组 []。

### 正确返回示例
[0,1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21]
`;

  try {
    // 调用Gemini API获取结果
    const aiResponse = await generateText({
      model: google('gemini-2.5-pro'),
      prompt: prompt,
    });
    console.log('AAAAA aiResponse', aiResponse);

    return "[0,1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21]";
  } catch (error) {
    console.error('❌ AI 筛选段落索引失败：', error);
    return '';
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('✅ 接收请求（含完整文档内容）');

    const {
      documentContext = {},
      selectedContext = {},
      enabledTools = { webSearch: false, isAgentMode: true },
      message = '',
      messages = [], // 用户编辑指令
    } = body;

    // 提取文档原始内容（从 documentContext 中获取）
    const rawDocumentContent = documentContext.documentContent || '';
    console.log('✅ 开始解析文档内容');

    // ------------------------------
    // 新增步骤 1：解析文档内容，提取结构化段落
    // ------------------------------
    const parsedDoc = parseDocumentContent(rawDocumentContent);
    console.log(`✅ 文档解析完成：总段落数 ${parsedDoc.totalParagraphs}，有效段落 ${parsedDoc.paragraphs.length}`);

    // ------------------------------
    // 新增步骤 2：调用 AI 筛选相关段落索引（pIdxs）
    // ------------------------------
    const pIdxs = await getRelevantParagraphIdxs(parsedDoc, message);
    console.log(`✅ AI 筛选完成，相关段落索引：`, pIdxs);

    // 2. 生成临时请求ID（仅用于工具调用时关联当前请求的文档，无存储）
    const requestId = uuidv4();

    // 保存文档（新增：将解析后的 pIdxs 存入 documentContext，供后续工具使用）
    saveDocument(requestId, {
      ...documentContext,
      message: message,
      parsedDocument: parsedDoc, // 存入解析后的结构化文档
      pIdxs: pIdxs // 存入 AI 筛选的段落索引
    });

    // 3. 构造Agent消息（仅传指令+请求ID+筛选后的 pIdxs，不传完整文档内容）
    const messagesWithContext = [
      {
        role: 'system',
        id: uuidv4(),
        parts: [
          {
            type: 'text',
            text: `
You MUST call readDocumentTool FIRST.
After readDocumentTool returns parsed content, you MUST call learnSkillsTool immediately after this tool.
After learnSkillsTool returns edit plan, you MUST call editDocumentTool immediately after this tool.

When calling readDocumentTool:
- Use requestId: ${requestId}
- Use pIdxs: ${JSON.stringify(pIdxs)} (this is the relevant paragraph indexes filtered by user demand)
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

    console.log('✅ 消息格式验证完成');

    // 5. 调用Agent（关键：把文档内容挂载到toolContext）
    const agentResponse = await weatherAgent.respond({
      messages: validatedMessages as any, // FIX: bypass type issue with UIMessage generic
      // 可选：将 pIdxs 传入 toolContext，供工具直接读取
    });

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
// 保留：原 readDocumentTool 可直接读取保存的 pIdxs
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
      pIdxs: {
        type: 'array',
        description: 'Nested array of relevant paragraph indexes',
        items: {
          type: ['number', 'array']
        }
      }
    },
    required: ['requestId'],
  },
  // 执行函数：ctx 包含 agent.respond 传入的 toolContext
  execute: async (params: { requestId: string; pIdxs?: (number | (number | any[])[])[] }, ctx: { toolContext: any }) => {
    try {
      // 1. 校验requestId（确保工具调用和当前请求匹配）
      if (params.requestId !== ctx.toolContext.requestId) {
        throw new Error(`Invalid requestId: ${params.requestId} (expected: ${ctx.toolContext.requestId})`);
      }

      // 2. 直接从 toolContext 读取文档和筛选后的 pIdxs
      const documentContext = ctx.toolContext.parsedDoc;
      const pIdxs = params.pIdxs || ctx.toolContext.pIdxs || [];

      // 3. 返回结构化的文档内容+筛选索引（供Agent后续使用）
      return {
        success: true,
        data: {
          requestId: params.requestId,
          pIdxs: pIdxs,
          documentContent: documentContext.rawContent,
          styleGuide: escapeSpecialChars(ctx.toolContext?.styleGuide || ''),
          selectedText: escapeSpecialChars(ctx.toolContext?.selectedText || ''),
          ooxml: ctx.toolContext?.ooxml || {}, // 已提前清洗
          // 给Agent的友好提示
          note: `Full document content loaded (${documentContext.totalParagraphs} paragraphs total) — proceed with editing as per instructions`,
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