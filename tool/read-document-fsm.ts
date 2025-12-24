import { DocumentFlowState } from '@/tool/workflow';
import { getDocument } from '@/tool/document-store';

export async function readDocumentFSM(input: { requestId: string }) {
  const document = await getDocument(input.requestId);

  if (!document) {
    return {
      state: DocumentFlowState.ERROR,
      error: 'Document not found',
    };
  }

  return {
    state: DocumentFlowState.DOCUMENT_LOADED,
    payload: document,
  };
}
