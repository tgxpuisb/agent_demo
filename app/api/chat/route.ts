import { weatherAgent } from '@/agent/weather-agent';
import { validateUIMessages} from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { saveDocument } from '@/tool/document-store';

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

// function corsHeaders(origin: string | null) {
//   return {
//     "Access-Control-Allow-Origin":  origin || '*',
//     "Access-Control-Allow-Credentials": "true",
//     "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
//     "Access-Control-Allow-Headers": "Content-Type, Authorization",
//   };
// }

// export async function OPTIONS(request: Request) {
//   const origin = request.headers.get("origin");
//   return new Response(null, {
//     status: 200,
//     headers: corsHeaders(origin),
//   });
// }

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('✅ 接收请求（含完整文档内容）');

    const {
      documentContext = {},
      selectedContext = {},
      enabledTools = { webSearch: false, isAgentMode: true },
      messages = [], // 用户编辑指令
    } = body;

    // get the last message
    if (messages.length <= 0) { 
      return new Response(
        JSON.stringify({
          code: 400,
          message: 'No messages',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const lastMessage = messages[messages.length - 1];
    const lastParts = lastMessage?.parts || [];
    if (lastParts.length <= 0) { 
      return new Response(
        JSON.stringify({
          code: 400,
          message: 'No parts',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const lastPart = lastParts[lastParts.length - 1];
    const message = lastPart?.text || '';
    console.log('✅ 获取用户编辑指令：', message);

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
    // const pIdxs = await getRelevantParagraphIdxs(parsedDoc, message);
    // console.log(`✅ AI 筛选完成，相关段落索引：`, pIdxs);

    // 2. 生成临时请求ID（仅用于工具调用时关联当前请求的文档，无存储）
    const requestId = uuidv4();

    // 保存文档（新增：将解析后的 pIdxs 存入 documentContext，供后续工具使用）
    saveDocument(requestId, {
      ...documentContext,
      message: message,
      parsedDocument: parsedDoc, // 存入解析后的结构化文档
      pIdxs: [0,1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21] // 存入 AI 筛选的段落索引
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
              You are a document-editing agent.

              You MUST follow this process strictly:

              Step 0: Determine relevant paragraph indexes (pIdxs).
              - You have access to:
                - the user's instruction: ${message}, and
                - the document content :${documentContext.documentContent}.
              - Based on BOTH, you MUST determine which paragraph indexes
                are relevant to the user's request.
              - pIdxs MUST be an array of 0-based paragraph indexes.
              - Only include paragraphs that are relevant to the user's instruction.
              - If no paragraph is relevant, use an empty array [].

              Step 1: Call readDocumentTool.
              - Use requestId: ${requestId}
              - Pass the pIdxs you determined in Step 0.
              - Do NOT ask the user for document content.

              Step 2: After readDocumentTool returns,
                      you MUST call learnSkillsTool immediately.
              - You MUST include the SAME pIdxs.

              Step 3: After learnSkillsTool returns,
                      you MUST call editDocumentTool immediately.
              - You MUST include the SAME pIdxs.

              Rules:
              - Always reuse the same requestId.
              - You MUST NOT skip any step.
              - You MUST NOT change pIdxs after Step 0.
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
