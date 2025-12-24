import { UIMessage } from "ai";
import { InferUITools } from "ai";
import { weatherAgent } from "@/agent/weather-agent";
// ⚠️ 简单内存存储（单实例可用）
export type DocumentContext = {
  documentContent?: string;
  styleGuide?: string;
  selectedText?: string;
  ooxml?: {
    body?: string;
  };
  messages?: any[];
  message?: string;
};

const documentStore = new Map<string, DocumentContext>();

export function saveDocument(requestId: string, doc: DocumentContext) {
  documentStore.set(requestId, doc);
}

export function getDocument(requestId: string): DocumentContext | undefined {
  return documentStore.get(requestId);
}

export function deleteDocument(requestId: string) {
  documentStore.delete(requestId);
}
