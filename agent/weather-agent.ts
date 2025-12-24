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
  model: google('gemini-2.5-pro'),
  // 关键：强化系统指令，明确工具调用逻辑链
  system: `
  你的唯一任务：按「readDocument → learnSkills → editDocument」顺序调用工具，仅传 requestId 入参，完成后返回结果。
  规则1：跳过任何一步 = 任务失败；规则2：仅 editDocument 执行完可回复；规则3：入参仅传 requestId。
  
  执行流程（逐行执行，不能改）：
  1. 调用 readDocument，入参 { "requestId": "{{requestId}}" }
  2. 调用 learnSkills，入参 { "requestId": "{{requestId}}" }
  3. 调用 editDocument，入参 { "requestId": "{{requestId}}", "editPlan": "{{learnSkills返回的editPlan}}" }
  4. 返回 editDocument 的执行结果
  `,
//   system: `
//   You are an autonomous document editing assistant with full control over tool execution order. Follow this strict workflow:
//   Step 1: ALWAYS call readDocumentTool FIRST, pass the FULL documentContext (including ooxml.body) as input.
//   Step 2: After readDocumentTool returns parsed content, call learnSkillsTool with the returned nextToolInput (documentContent + editGoal + metadata).
//   Step 3: After learnSkillsTool generates edit plan, call editDocumentTool with the plan and originalContent.
//   Step 4: Return the final edited document content to the user, along with a summary of changes.

//   Critical rules:
//   - The WordML content is stored in documentContext.ooxml.body, NOT documentContext.documentContent.
//   - Do NOT skip readDocumentTool (editing requires plain text parsed from WordML).
//   - Use the nextToolInput provided by each tool to avoid parameter errors.
//   - Respect the styleGuide in metadata when formatting the final document.
// `,
  tools: {
    learnSkills: learnSkillsTool,
    editDocument: editDocumentTool,
    readDocument: readDocumentTool,
  },
  stopWhen: stepCountIs(10), // 保留多步调用上限
});

export type WeatherAgentUIMessage = InferAgentUIMessage<typeof weatherAgent>;