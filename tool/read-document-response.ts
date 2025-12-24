export type ReadDocumentResponse = {
  documentId: string;
  documentContent: string;
  parsedText: string;
  ooxml: any;
  messages: any[];
  message: string;
  nextTool: string;
  metadata: {
    selectedText: string;
    styleGuide: string;
  };
};


const readDocumentResponseStore = new Map<string, ReadDocumentResponse>();

export function saveReadDocumentResponse(requestId: string, doc: ReadDocumentResponse) {
  readDocumentResponseStore.set(requestId, doc);
}

export function getReadDocumentResponse(requestId: string): ReadDocumentResponse | undefined {
  return readDocumentResponseStore.get(requestId);
}

export function deleteReadDocumentResponse(requestId: string) {
  readDocumentResponseStore.delete(requestId);
}