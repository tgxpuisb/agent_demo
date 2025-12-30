import { tool, UIToolInvocation } from 'ai';
import { z } from 'zod';
import { getReadDocumentResponse } from '@/tool/read-document-response';

const EditSchema = z.object({
  des: z.string(),
  edits: z.array(
    z.object({
      t: z.literal('paragraph'),
      v: z.object({
        i: z.number(),
        o: z.enum(['replace', 'before', 'after', 'delete']),
        xml: z.string().optional(),
      }),
    }),
  ),
  requestId: z.string(),
});

export const editDocumentTool = tool({
  description: `
Apply XML edits to the document.

Pure executor.
- No planning
- No AI reasoning
- Deterministic only
`,

  inputSchema: EditSchema,

  async *execute({ des, edits, requestId }) {
    console.log('AAA editDocumentTool in', requestId);
    yield { state: 'loading' as const };

    const ctx = await getReadDocumentResponse(requestId);

    if (!ctx) {
      yield {
        state: 'error' as const,
        value: { message: `No context found for requestId: ${requestId}` },
      };
      return;
    }

    if (!ctx.ooxml?.body) {
      yield {
        state: 'error' as const,
        value: {
          message:
            'Document OOXML body is missing. Ensure readDocumentTool was executed first.',
        },
      };
      return;
    }

    const originalXml = ctx.ooxml.body;

    // ⚠️ TODO: apply edits here
    // const modifiedOoxml = applyEdits(originalXml, edits);
    const modifiedOoxml = originalXml; // placeholder

    yield {
      state: 'ready' as const,
      value: {
        status: 'success',
        description: des,
        appliedEdits: edits.length,
        modifiedOoxml,
      },
    };
  },
});

export type EditDocumentInvocation = UIToolInvocation<typeof editDocumentTool>;
