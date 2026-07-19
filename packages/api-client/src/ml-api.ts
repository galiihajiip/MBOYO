import {
  healthResponseSchema,
  type HealthResponse,
  modelInfoResponseSchema,
  type ModelInfoResponse,
  readyResponseSchema,
  type ReadyResponse,
  validateImageRequestSchema,
  validateImageResponseSchema,
  type ValidateImageRequest,
  type ValidateImageResponse,
  predictRequestSchema,
  predictResponseSchema,
  type PredictRequest,
  type PredictResponse,
  explainRequestSchema,
  explainResponseSchema,
  type ExplainRequest,
  type ExplainResponse,
} from "@mboyo/domain";

export interface MlApiClientConfig {
  baseUrl: string;
  internalToken: string;
  fetchImpl?: typeof fetch;
}

/**
 * Typed client for apps/ml-api. Only ever called from apps/web's server
 * runtime or apps/worker — never from browser code, per AGENTS.md
 * (ML_INTERNAL_TOKEN must never reach the client bundle).
 */
export class MlApiClient {
  private readonly baseUrl: string;
  private readonly internalToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: MlApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.internalToken = config.internalToken;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private authHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.internalToken}`,
      "Content-Type": "application/json",
    };
  }

  async health(): Promise<HealthResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/health`, {
      method: "GET",
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      throw new Error(
        `apps/ml-api health check failed with status ${response.status}`,
      );
    }

    const body: unknown = await response.json();
    return healthResponseSchema.parse(body);
  }

  async ready(): Promise<ReadyResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/ready`, {
      method: "GET",
      headers: this.authHeaders(),
    });
    const body: unknown = await response.json();
    return readyResponseSchema.parse(body);
  }

  async modelInfo(): Promise<ModelInfoResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/model-info`, {
      method: "GET",
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      throw new Error(`apps/ml-api model-info failed with status ${response.status}`);
    }
    const body: unknown = await response.json();
    return modelInfoResponseSchema.parse(body);
  }

  async validateImage(input: ValidateImageRequest): Promise<ValidateImageResponse> {
    const payload = validateImageRequestSchema.parse(input);
    const response = await this.fetchImpl(`${this.baseUrl}/validate-image`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`apps/ml-api validate-image failed with status ${response.status}`);
    }
    const body: unknown = await response.json();
    return validateImageResponseSchema.parse(body);
  }

  async predict(input: PredictRequest): Promise<PredictResponse> {
    const payload = predictRequestSchema.parse(input);
    const response = await this.fetchImpl(`${this.baseUrl}/predict`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`apps/ml-api predict failed with status ${response.status}`);
    }
    const body: unknown = await response.json();
    return predictResponseSchema.parse(body);
  }

  async explain(input: ExplainRequest): Promise<ExplainResponse> {
    const payload = explainRequestSchema.parse(input);
    const response = await this.fetchImpl(`${this.baseUrl}/explain`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`apps/ml-api explain failed with status ${response.status}`);
    }
    const body: unknown = await response.json();
    return explainResponseSchema.parse(body);
  }
}
