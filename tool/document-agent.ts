import { Experimental_Agent as Agent, Experimental_InferAgentUIMessage as InferAgentUIMessage, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google'; // AI SDK v5 适配的Gemini适配器
import { readDocumentTool, webExtractTool, learnSkillsTool } from '@/tool';

// 初始化文档处理Agent
export const documentAgent = new Agent({
  model: google('gemini-2.5-flash-lite'),
  system: 'You are a professional document editing assistant, use the provided tools to complete document-related tasks accurately. Follow the tool usage rules strictly.',
  tools: documentTools, // 挂载所有拆分后的工具
  stopWhen: stepCountIs(10), // 限制最大步骤数
});

// 导出Agent消息类型（供前端使用）
export type DocumentAgentUIMessage = InferAgentUIMessage<typeof documentAgent>;