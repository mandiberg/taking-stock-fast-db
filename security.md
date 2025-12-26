# Security Features

The MCP server implements several security measures for safe database querying.

## Implemented

- **Readonly SQL Queries**: enforced by the ClickHouse client
- **Row Limiting**: Results are capped at a default of 100 rows, but this limit can be configured up to a maximum of 1000 rows to prevent excessive data transfer
- **Error Handling**: Security errors returned through MCP protocol without exposing internals

## Production Considerations

Before deploying to production, consider adding:

- **Authentication & Authorization**: API key authentication is available (see README)
- **Rate Limiting**: Protect against abuse and DoS attacks
- **Query Timeouts**: Prevent long-running queries from consuming resources
- **Audit Logging**: Track who executed which queries and when
- **IP Whitelisting**: Restrict access to known clients
- **TLS/HTTPS**: Encrypt data in transit

The current implementation provides a secure foundation for read-only database access but should be enhanced with additional production-grade features based on your deployment requirements.
