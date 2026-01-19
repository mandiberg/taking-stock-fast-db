import { createAnthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, UIMessage, stepCountIs } from "ai";
import { experimental_createMCPClient } from "@ai-sdk/mcp";
import { getAISystemPrompt } from "./system-prompt";
import { getAnthropicApiKey, getMcpServerUrl } from "@/env-vars";

let cachedTools: any | null = null;

export async function getAnthropicAgentStreamTextOptions(
  messages: UIMessage[],
): Promise<any> {
  const apiKey = getAnthropicApiKey();

  const anthropic = createAnthropic({
    apiKey,
  });

  // 🔒 Trim message history
  const trimmedMessages = messages.slice(-10);
  const modelMessages = convertToModelMessages(trimmedMessages);

  // MCP setup
  const mcpServerUrl = getMcpServerUrl();
  const mcpApiKey = process.env.MCP_API_TOKEN;

  const mcpClient = await experimental_createMCPClient({
    name: "moose-mcp-server",
    transport: {
      type: "http",
      url: `${mcpServerUrl}/tools`,
      ...(mcpApiKey && {
        headers: { Authorization: `Bearer ${mcpApiKey}` },
      }),
    },
  });

  if (!cachedTools) {
    cachedTools = await mcpClient.tools();
    console.log("[Agent Config] Available tools:", Object.keys(cachedTools));
  }

  return {
    model: anthropic("claude-haiku-4-5"),

    // 🔒 HARD LIMITS (THIS FIXES YOUR CRASH)
    maxTokens: 2048,

    system: getAISystemPrompt(),
    messages: modelMessages,
    tools: cachedTools,
    toolChoice: "auto",

    // Reduce reasoning amplification
    stopWhen: stepCountIs(8),
  };

}
