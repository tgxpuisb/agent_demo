import { weatherTool } from '@/tool/weather-tool';
import { editDocumentTool } from '@/tool/edit-document';
import { webExtractTool } from '@/tool/web-extract';
import { learnSkillsTool } from '@/tool/learn-skills';
import { searchFilesTool } from '@/tool/search-files';
import { webSearchTool } from '@/tool/web-search';
import { readDocumentTool } from '@/tool/read-document';
import { google } from '@ai-sdk/google';
import {
  Experimental_Agent as Agent,
  Experimental_InferAgentUIMessage as InferAgentUIMessage,
  stepCountIs,
} from 'ai';

export const weatherAgent = new Agent({
  model: google('gemini-2.5-flash-lite'),
  // 关键：强化系统指令，明确工具调用逻辑链
  system: `
    You are a helpful assistant
  `,
  tools: {
    learnSkills: learnSkillsTool,
    editDocument: editDocumentTool,
    readDocument: readDocumentTool,
  },
  stopWhen: stepCountIs(10), // 保留多步调用上限
  // 可选：添加工具调用后 Hook，确保逻辑执行
  // onToolResult: async (toolResult, context) => {
  //   // 如果刚执行完 learnSkills，主动提示下一步调用 editDocument
  //   if (toolResult.toolName === 'learnSkills' && toolResult.state === 'ready') {
  //     return {
  //       continue: true, // 告诉 Agent 继续思考
  //       thoughts: `Need to execute editDocumentTool with the plan from learnSkills: ${JSON.stringify(toolResult.result?.plan)}`,
  //     };
  //   }
  //   return { continue: true };
  // },
});

export type WeatherAgentUIMessage = InferAgentUIMessage<typeof weatherAgent>;