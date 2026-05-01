export class UpgradeError extends Error {
  code: string;
  tier: string;
  current: number | null;
  limit: number | null;

  constructor(detail: { code?: string; message?: string; tier?: string; current?: number | null; limit?: number | null }) {
    super(detail.message || 'Plan limit reached.');
    this.name = 'UpgradeError';
    this.code = detail.code || 'DEFAULT';
    this.tier = detail.tier || '';
    this.current = detail.current ?? null;
    this.limit = detail.limit ?? null;
  }
}
