import { REGISTERED_TOOLS } from "./tools.js";

/**
 * Auto-generates OpenAPI 3.1.0 specification for OpenAI Custom GPT Actions.
 * ChatGPT imports this schema directly in the "Configure > Actions" panel.
 */
export function generateOpenApiSpec(serverBaseUrl = "https://api.prometheus.media"): Record<string, unknown> {
  const paths: Record<string, unknown> = {};

  for (const tool of REGISTERED_TOOLS) {
    const routePath = `/api/v1/actions/${tool.name}`;

    paths[routePath] = {
      post: {
        operationId: tool.name,
        summary: tool.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: tool.description,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: tool.inputSchema
            }
          }
        },
        responses: {
          "200": {
            description: "Successful operation result with sanitized response payload",
            content: {
              "application/json": {
                schema: {
                  type: "object"
                }
              }
            }
          },
          "400": {
            description: "Validation or security policy error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Prometheus Vincere AI Gateway",
      description:
        "Atomic, secure creative rendering and editorial intelligence actions for ChatGPT and automated clients.",
      version: "1.0.0"
    },
    servers: [
      {
        url: serverBaseUrl,
        description: "Prometheus Vincere Production Gateway"
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "PAT",
          description: "Scoped Personal Access Token (e.g. pat_<tenant>_<user>_<hash>)"
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ],
    paths
  };
}
