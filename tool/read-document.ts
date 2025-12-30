import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';

import { getDocument } from '@/tool/document-store';
import { saveReadDocumentResponse } from '@/tool/read-document-response';

// 修复后：明确递归类型边界 + 数组类型断言，解决报错
const PIdxSchema: z.ZodType<number | (number | readonly (number | readonly any[])[])[]> = z.lazy(() => 
  z.union([
    z.number().int().nonnegative(), // 非负整数索引（匹配抓包的 0,1,12 等）
    // 明确数组类型，断言为递归嵌套数组，避免 Zod 解析歧义
    z.array(PIdxSchema) as z.ZodType<(number | readonly (number | readonly any[])[])[]>
  ])
);

const ReadDocumentInputSchema = z.object({
  requestId: z.string(),
  pIdxs: z.array(PIdxSchema), // 严格匹配抓包的 pIdxs 嵌套数组格式
});

export const readDocumentTool = tool({
  description: `
    This tool loads and parses a document, and extracts specific paragraphs according to the provided pIdxs (nested paragraph indexes).

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
  inputSchema: ReadDocumentInputSchema,

  // 2. 推导精准参数类型，避免 any[] 带来的类型问题
  async *execute({ requestId, pIdxs }: z.infer<typeof ReadDocumentInputSchema>) {
    // 输出增量加载状态（对齐抓包的 tool-input-delta 行为）
    yield { 
      state: 'loading' as const, 
      value: { message: 'Receiving pIdxs and loading document...' } 
    };
    console.log('AAA readDocumentTool in', requestId, 'pIdxs:', pIdxs);

    const documentContext = await getDocument(requestId);

    if (!documentContext) {
      const errorMsg = `No document found for requestId: ${requestId}`;
      console.log('AAA readDocumentTool error', errorMsg);
      yield {
        state: 'error' as const,
        value: { 
          status: 'error' as const,
          content: errorMsg,
          data: { paragraphs: [] as string[] },
        },
      };
      return;
    }

    const wordML = documentContext.ooxml?.body ?? '';
    if (!wordML) {
      const errorMsg = `No OOXML body found for requestId: ${requestId}`;
      console.log('AAA readDocumentTool error', errorMsg);
      yield {
        state: 'error' as const,
        value: {
          status: 'error' as const,
          content: errorMsg,
          data: { paragraphs: [] as string[] },
        }
      };
      return;
    }

    // 3. 修正段落解析逻辑：保留完整 <w:p> 标签及内部XML（完全对齐抓包输出）
    const paragraphList = extractCompleteWpParagraphs(wordML);
    yield { 
      state: 'processing' as const, 
      value: { message: `Parsed ${paragraphList.length} total paragraphs from document...` } 
    };

    // 4. 处理 pIdxs：扁平化嵌套数组 + 筛选有效索引（严格匹配抓包输入的嵌套格式）
    const flatPIdxs = flattenNestedArray(pIdxs);
    const validPIdxs = flatPIdxs.filter(idx => idx >= 0 && idx < paragraphList.length);
    const relevantParagraphs = validPIdxs.map(idx => paragraphList[idx]);

    // 5. 保留原有保存逻辑，补充完整段落标签数据（确保后续流程数据一致性）
    await saveReadDocumentResponse(requestId, {
      documentId: requestId,
      documentContent: documentContext.documentContent ?? '',
      parsedText: paragraphList.join('\n\n'), // 保留完整XML拼接的文本
      ooxml: documentContext.ooxml,
      messages: documentContext.messages ?? [],
      message: documentContext.message ?? '',
      nextTool: 'editDocumentTool',
      metadata: {
        selectedText: documentContext.selectedText ?? '',
        styleGuide: documentContext.styleGuide ?? '',
        relevantParagraphs: relevantParagraphs, // 保存完整 <w:p> 段落
        usedPIdxs: validPIdxs
      },
    });

    // 6. 严格对齐抓包输出格式：仅保留 status、content、data.paragraphs 三个核心字段
    const response = {
      status: 'success' as const,
      content: `Read ${relevantParagraphs.length} relevant paragraphs before editing`,
      data: {
        paragraphs: relevantParagraphs, // 完整 <w:p> 标签列表，与抓包完全一致
      },
    };

    console.log('AAA readDocumentTool out', `Returned ${relevantParagraphs.length}`);

    // 输出最终就绪状态（返回值与抓包格式完全匹配）
    yield {
      state: 'ready' as const,
      value: response,
    };
  },
});

// 辅助函数 1：递归扁平化嵌套数组（处理 pIdxs 嵌套结构，避免 any[] 优化类型）
function flattenNestedArray(arr: (number | readonly (number | readonly any[])[])[]): number[] {
  let result: number[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      // 递归处理嵌套数组，严格匹配抓包的 [0,1,...,10,[12,21]] 格式
      result = result.concat(flattenNestedArray(item as (number | readonly (number | readonly any[])[])[]));
    } else if (typeof item === 'number' && Number.isInteger(item) && item >= 0) {
      // 仅保留非负整数索引，与抓包输入一致
      result.push(item);
    }
  }
  // 去重+排序，避免重复提取同一段落
  return Array.from(new Set(result)).sort((a: number, b: number) => a - b);
}

// 辅助函数 2：解析 Word ML，提取完整 <w:p> 标签（包括所有属性和内部XML，完全对齐抓包输出）
function extractCompleteWpParagraphs(wordML: string): string[] {
  const paragraphs: string[] = [];
  // 匹配完整 <w:p> 标签（包含所有属性、内部内容，与抓包的 paragraphs 格式一致）
  const pTagRegex = /<w:p[^>]*>[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = pTagRegex.exec(wordML)) !== null) {
    // 直接保留完整的 <w:p> 标签内容，不做纯文本提取（核心修正：对齐抓包数据）
    paragraphs.push(match[0].trim());
  }

  return paragraphs;
}

// 导出工具调用类型（严格推导，避免类型不匹配）
export type ReadDocumentUIToolInvocation = UIToolInvocation<typeof readDocumentTool>;