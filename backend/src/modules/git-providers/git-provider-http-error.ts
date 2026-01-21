// Provide status-aware HTTP errors for git provider API requests. kzxac35mxk0fg358i7zs
export class GitProviderHttpError extends Error {
  provider: 'gitlab' | 'github';
  status: number;
  statusText: string;
  url: string;
  method: string;
  responseText: string;

  constructor(params: {
    provider: 'gitlab' | 'github';
    status: number;
    statusText: string;
    url: string;
    method: string;
    responseText?: string;
    message?: string;
  }) {
    super(params.message);
    this.name = 'GitProviderHttpError';
    this.provider = params.provider;
    this.status = params.status;
    this.statusText = params.statusText;
    this.url = params.url;
    this.method = params.method;
    this.responseText = params.responseText ?? '';
  }
}

export const isGitProviderHttpError = (err: unknown): err is GitProviderHttpError => {
  return Boolean(err) && typeof err === 'object' && (err as any).name === 'GitProviderHttpError' && typeof (err as any).status === 'number';
};
