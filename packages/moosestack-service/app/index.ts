// Export all data models
export * from "./ingest/models";

// Import and reference imagesAnalytical to ensure MooseStack creates the table
// This ensures the table exists even if it's not used in workflows/APIs
import { imagesAnalytical } from "./ingest/models";

// Reference the table so MooseStack knows to create it
// This is a no-op but ensures the table definition is processed
void imagesAnalytical;

// Export all APIs (including MCP server)
export * from "./apis/mcp";
