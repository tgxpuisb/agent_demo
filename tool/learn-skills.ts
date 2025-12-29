import { UIToolInvocation, tool } from 'ai';
import { z } from 'zod';
import { getReadDocumentResponse } from '@/tool/read-document-response';

// 入参Schema：只接收requestId + skills，和对方抓包一致
const learnSkillsInputSchema = z.object({
  requestId: z.string(),
  skills: z.array(z.string()).optional().default(['lists']), // 默认传lists，和对方一致
});

// 辅助类型定义：贴合 readDocumentTool 返回的 XML 段落数据
type WpParagraph = string; // 即 <w:p> 完整 XML 字符串
type ParsedParagraphInfo = {
  idx: number; // 段落索引
  wpXml: WpParagraph; // 完整 <w:p> XML
  plainText: string; // 提取的纯文本内容
  style: string; // 段落样式（如 DocumentName、Sch2Number）
  hasNumPr: boolean; // 是否已有列表标记 <w:numPr>
};

export const learnSkillsTool = tool({
  description: `
This tool returns professional editing skill guides for Word document operations. 
The guide contains strict rules and JSON examples for editing paragraphs/lists with Word XML.
AFTER this tool finishes:
1. You MUST read the returned skill guide carefully.
2. You MUST generate a structured edit instruction JSON with des + edits array for editDocument tool.
3. You MUST use the exact XML format from the guide and the actual document XML in the edits array.
4. You MUST NOT call any other tools except editDocument.
You MUST NOT return any text to user directly.
`,
  inputSchema: learnSkillsInputSchema,
  async *execute({ requestId, skills }: z.infer<typeof learnSkillsInputSchema>) {
    console.log('AAA learnSkillsTool in', requestId, 'skills:', skills);
    const readDocumentResponse = await getReadDocumentResponse(requestId);

    if (!readDocumentResponse) {
      const errorMsg = `No read document response found for requestId: ${requestId}`;
      console.log('AAA learnSkillsTool error', errorMsg);
      yield { state: 'error' as const, value: { message: errorMsg } };
      return;
    }

    // ======================================
    // 新增：1. 提取 readDocumentTool 返回的核心 XML 段落数据
    // ======================================
    // 从 readDocumentResponse 中获取相关段落（两种方式，选其一即可）
    // 方式1：若你已在 saveReadDocumentResponse 中启用 selectedParagraphs（取消注释）
    const rawWpParagraphs = readDocumentResponse.metadata?.relevantParagraphs || [];
    
    // 方式2：若未启用，从 ooxml.body 中重新提取（兼容原有逻辑）
    const fallbackWpParagraphs = readDocumentResponse.ooxml?.body 
      ? extractCompleteWpParagraphs(readDocumentResponse.ooxml.body) 
      : [];
    const wpParagraphs = rawWpParagraphs.length > 0 ? rawWpParagraphs : fallbackWpParagraphs;

    // ======================================
    // 新增：2. 解析 XML 段落，提取纯文本、样式等关键信息
    // ======================================
    const parsedParagraphs: ParsedParagraphInfo[] = wpParagraphs.map((wpXml, idx) => ({
      idx,
      wpXml,
      plainText: extractTextFromWpXml(wpXml), // 提取纯文本
      style: extractParagraphStyleFromWpXml(wpXml), // 提取段落样式
      hasNumPr: hasNumPrInWpXml(wpXml), // 判断是否已有列表标记
    })).filter(para => para.plainText.trim() !== ''); // 过滤空段落

    // ======================================
    // 新增：3. 动态生成文档结构参考（替换原有固定内容）
    // ======================================
    const documentStructureRef = parsedParagraphs.map(para => 
      `p${para.idx}|${para.style}|${para.plainText.substring(0, 50)}${para.plainText.length > 50 ? '...' : ''}`
    ).join('\n');
    const totalParagraphs = parsedParagraphs.length;

    // ======================================
    // 优化：4. 结合实际 XML 数据，动态生成技能指南（保留原有核心结构）
    // ======================================
    const skillGuide = {
      content: `Guide to Lists (Index-Based Editing)
# Purpose
Use this guide to create, edit, or remove lists by editing paragraphs with <w:numPr> in Word XML using index-based operations.
# Core Principles
1) Index-based targeting (no paraId)
- Paragraph edits use pIdx (0-based paragraph index from the document structure).
- Do not rely on or output matching by w14:paraId; matching is index-based.
- Supported operations: replace, before, after, delete.
2) Lists are paragraphs with numbering
- Regular paragraph + <w:numPr> = list item.
- <w:ilvl> controls nesting (0 = top level, 1 = nested, etc.).
- <w:numId> identifies the list definition; same numId continues the list.
3) Tracking changes
- Do NOT output <w:ins> or <w:del>. The system applies edits with tracking automatically.
4) Indentation
- Do not add <w:ind> for list paragraphs. Let <w:ilvl> drive indentation.
# Document Structure Reference (Actual Data from Read Document)
DOC: ${totalParagraphs}p, ${parsedParagraphs.filter(p => p.hasNumPr).length}t
${documentStructureRef}
# Examples (JSON tool input, Aligned with Actual Document XML)
{
  "des": "Convert to list (Based on actual paragraph style: ${parsedParagraphs[0]?.style || 'ListParagraph'})",
  "edits": [
    {
      "t": "paragraph",
      "v": {
        "i": 0, // Use actual pIdx from Document Structure Reference above
        "o": "replace",
        "xml": "<w:p><w:pPr><w:pStyle w:val='${parsedParagraphs[0]?.style || 'ListParagraph'}'/><w:numPr><w:ilvl w:val='0'/><w:numId w:val='1'/></w:numPr></w:pPr><w:r><w:t>${parsedParagraphs[0]?.plainText.substring(0, 20)}...</w:t></w:r></w:p>"
      }
    }
  ]
}`,
      status: "success",
      data: [
        {
          _id: "68fa797dddfb3f36d74710c8",
          name: "lists",
          instructions: `Guide to Lists (Index-Based Editing) # Purpose Use this guide to create, edit, or remove lists by editing paragraphs with \`<w:numPr>\` in Word XML using index-based operations. # Actual Document Context Total Paragraphs: ${totalParagraphs}, Existing Lists: ${parsedParagraphs.filter(p => p.hasNumPr).length}`
        }
      ]
    };

    // ======================================
    // 保留：5. 返回技能指南 + 告诉Agent下一步调用editDocument
    // ======================================
    const result = {
      requestId,
      ...skillGuide,
      nextTool: "editDocument",
      note: `Use the guide to generate structured edit instruction for editDocument tool with des and edits array. Refer to the actual Document Structure Reference (${totalParagraphs} paragraphs) for accurate pIdx.`,
      // 附加：传递解析后的段落信息，方便后续工具直接使用
      documentContext: {
        totalParagraphs,
        parsedParagraphs: parsedParagraphs.map(para => ({
          idx: para.idx,
          style: para.style,
          plainText: para.plainText,
          hasNumPr: para.hasNumPr
        }))
      }
    };

    console.log('AAA learnSkillsTool out', `Returned guide with ${totalParagraphs} actual paragraphs`, result);
    yield { state: 'ready' as const, value: result };
  },
});

// ======================================
// 新增：辅助函数（解析 Word XML <w:p> 标签）
// ======================================
/**
 * 从 <w:p> XML 中提取纯文本内容（忽略所有格式标签）
 */
function extractTextFromWpXml(wpXml: string): string {
  if (!wpXml) return '';
  // 匹配所有 <w:t> 节点中的文本内容
  const tTagRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match;
  const textParts: string[] = [];

  while ((match = tTagRegex.exec(wpXml)) !== null) {
    textParts.push(match[1].trim());
  }

  // 合并纯文本，去除多余空格
  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * 从 <w:p> XML 中提取段落样式（<w:pStyle w:val="xxx"/>）
 */
function extractParagraphStyleFromWpXml(wpXml: string): string {
  if (!wpXml) return 'Normal';
  // 匹配 <w:pStyle> 中的 val 属性
  const styleRegex = /<w:pStyle w:val="([^"]+)"/;
  const match = styleRegex.exec(wpXml);
  return match ? match[1] : 'Normal';
}

/**
 * 判断 <w:p> XML 中是否包含列表标记 <w:numPr>
 */
function hasNumPrInWpXml(wpXml: string): boolean {
  if (!wpXml) return false;
  const numPrRegex = /<w:numPr[^>]*>[\s\S]*?<\/w:numPr>/;
  return numPrRegex.test(wpXml);
}

/**
 * 兼容：提取完整 <w:p> 标签（与 readDocumentTool 保持一致）
 */
function extractCompleteWpParagraphs(wordML: string): string[] {
  const paragraphs: string[] = [];
  const pTagRegex = /<w:p[^>]*>[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = pTagRegex.exec(wordML)) !== null) {
    paragraphs.push(match[0].trim());
  }

  return paragraphs;
}

// 导出工具调用类型
export type LearnSkillsUIToolInvocation = UIToolInvocation<typeof learnSkillsTool>;