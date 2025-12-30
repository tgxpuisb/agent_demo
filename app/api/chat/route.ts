import { weatherAgent } from '@/agent/weather-agent';
import { validateUIMessages } from 'ai';
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

interface ParsedDocument {
  totalParagraphs: number;
  paragraphs: Array<{ index: number; content: string }>;
  rawContent: string;
}

const parseDocumentContent = (documentContent: string): ParsedDocument => {
  const result: ParsedDocument = {
    totalParagraphs: 0,
    paragraphs: [],
    rawContent: escapeSpecialChars(documentContent || ''),
  };

  if (!documentContent) return result;

  const lines = documentContent
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const docLine = lines.find(line => line.startsWith('DOC:'));
  if (docLine) {
    const m = docLine.match(/DOC:\s*(\d+)p/);
    if (m) result.totalParagraphs = parseInt(m[1], 10);
  }

  const paragraphRegex = /^p(\d+)\|(.+)$/;
  for (const line of lines) {
    const m = line.match(paragraphRegex);
    if (m) {
      result.paragraphs.push({
        index: Number(m[1]),
        content: escapeSpecialChars(m[2]),
      });
    }
  }

  result.paragraphs.sort((a, b) => a.index - b.index);
  return result;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      documentContext = {},
      messages = [],
    } = body;

    if (!messages.length) {
      return new Response(JSON.stringify({ error: 'No messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lastPart =
      messages[messages.length - 1]?.parts?.slice(-1)?.[0];
    const userInstruction = lastPart?.text || '';

    const parsedDoc = parseDocumentContent(
      documentContext.documentContent || '',
    );

    const requestId = uuidv4();

    saveDocument(requestId, {
      ...documentContext,
      message: userInstruction,
      parsedDocument: parsedDoc,
      pIdxs: [0, 1, 2, 3, 4, 5], // demo
    });

    const systemMessage = {
      role: 'system',
      id: uuidv4(),
      parts: [
        {
          type: 'text',
          text: `
You are a document-editing agent.

Step 0: Determine relevant paragraph indexes (pIdxs)
based on:
- user instruction: ${userInstruction}
- document content: ${documentContext.documentContent}

Then:
1. call readDocumentTool
2. call learnSkillsTool
3. call editDocumentTool

Rules:
- reuse requestId: ${requestId}
- never change pIdxs
          `.trim(),
        },
      ],
    };

    const validatedMessages = await validateUIMessages({
      messages: [systemMessage, ...messages],
    });

    const agentResponse = await weatherAgent.respond({
      messages: validatedMessages as any,
    });

    // -----------------------------
    // ✅ 心跳 + agent 输出 合并流
    // -----------------------------
    const encoder = new TextEncoder();
    const reader = agentResponse.body!.getReader();

    let closed = false;

    const stream = new ReadableStream({
      start(controller) {
        // 心跳定时器
        const heartbeat = setInterval(() => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(`:heartbeat ${Date.now()}\n\n`),
          );
        }, 15000); // 15s 一次

        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } finally {
            closed = true;
            clearInterval(heartbeat);
            controller.close();
          }
        };

        pump();
      },
    });

    return new Response(stream, {
      status: agentResponse.status,
      headers: {
        ...Object.fromEntries(agentResponse.headers),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
