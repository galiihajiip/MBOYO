/**
 * A minimal fake Supabase client double for unit-testing the domain-service
 * functions in lib/reports/service/* without a live database. Each
 * service function is designed to take an explicit db client argument
 * specifically so a test can substitute this instead of mocking
 * next/server or standing up a real Supabase instance (see
 * lib/reports/service/types.ts's ReportsDbClient doc comment).
 *
 * This is NOT a general-purpose Supabase mock — it only implements the
 * narrow chainable surface (.from/.select/.eq/.neq/.in/.ilike/.order/
 * .range/.upsert/.single/.maybeSingle/.returns, plus .rpc) that the
 * functions under test actually call, with each method recorded so a test
 * can assert on the exact query shape if it needs to.
 */

export interface FakeQueryResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

type Resolver = () => FakeQueryResult<unknown>;

export class FakeQueryBuilder {
  readonly calls: Array<{ method: string; args: unknown[] }> = [];
  private resolver: Resolver;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  private record(method: string, args: unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }

  select(...args: unknown[]): this {
    return this.record("select", args);
  }
  eq(...args: unknown[]): this {
    return this.record("eq", args);
  }
  neq(...args: unknown[]): this {
    return this.record("neq", args);
  }
  in(...args: unknown[]): this {
    return this.record("in", args);
  }
  ilike(...args: unknown[]): this {
    return this.record("ilike", args);
  }
  like(...args: unknown[]): this {
    return this.record("like", args);
  }
  gte(...args: unknown[]): this {
    return this.record("gte", args);
  }
  lte(...args: unknown[]): this {
    return this.record("lte", args);
  }
  lt(...args: unknown[]): this {
    return this.record("lt", args);
  }
  is(...args: unknown[]): this {
    return this.record("is", args);
  }
  not(...args: unknown[]): this {
    return this.record("not", args);
  }
  order(...args: unknown[]): this {
    return this.record("order", args);
  }
  range(...args: unknown[]): this {
    return this.record("range", args);
  }
  limit(...args: unknown[]): this {
    return this.record("limit", args);
  }
  upsert(...args: unknown[]): this {
    return this.record("upsert", args);
  }
  update(...args: unknown[]): this {
    return this.record("update", args);
  }
  insert(...args: unknown[]): this {
    return this.record("insert", args);
  }
  delete(...args: unknown[]): this {
    return this.record("delete", args);
  }

  single<T>(): Promise<FakeQueryResult<T>> {
    this.record("single", []);
    return Promise.resolve(this.resolver() as FakeQueryResult<T>);
  }

  maybeSingle<T>(): Promise<FakeQueryResult<T>> {
    this.record("maybeSingle", []);
    return Promise.resolve(this.resolver() as FakeQueryResult<T>);
  }

  returns<T>(): Promise<FakeQueryResult<T>> {
    this.record("returns", []);
    return Promise.resolve(this.resolver() as FakeQueryResult<T>);
  }

  // Query builders are thenable in the real client (awaiting them directly
  // resolves the query) — implemented so `await query` without a terminal
  // call also works, matching real usage in list.ts.
  then<TResult1 = FakeQueryResult<unknown>, TResult2 = never>(
    onfulfilled?: ((value: FakeQueryResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolver()).then(onfulfilled ?? undefined);
  }
}

export interface FakeDbConfig {
  /**
   * Keyed by table name. A single Resolver applies to every .from(table)
   * call; an array of Resolvers is consumed one-per-call in order (for
   * functions like createReport that call .from() on the same table more
   * than once with different expected results per call) — the last entry
   * repeats once exhausted, so a test only needs to specify as many
   * variants as actually differ.
   */
  from?: Record<string, Resolver | Resolver[]>;
  /** Keyed by rpc function name. */
  rpc?: Record<string, Resolver>;
  /**
   * Keyed by bucket name, resolving a .storage.from(bucket).download(path)
   * call — used by lib/reports/service/gemini-advisory.ts to fetch
   * evidence bytes for redaction/sending. Only `.download()` is
   * implemented (the narrow surface that service actually calls), per
   * this file's own "only implements what's actually called" philosophy.
   */
  storage?: Record<string, (path: string) => { data: Blob | null; error: { message: string } | null }>;
  /**
   * Keyed by bucket name, resolving a
   * .storage.from(bucket).createSignedUrl(path, ttl) call — used by
   * lib/reports/service/evidence.ts. Separate from `storage` above since a
   * given test only ever needs the one method its function under test
   * actually calls.
   */
  storageSignedUrl?: Record<
    string,
    (path: string, ttlSeconds: number) => { data: { signedUrl: string } | null; error: { message: string } | null }
  >;
  /**
   * Keyed by bucket name, resolving a
   * .storage.from(bucket).upload(path, body, options) call — used by
   * lib/command/exports.ts to write generated CSV/GeoJSON files. `body` is
   * passed through so a test can assert on the exact uploaded content
   * (e.g. verifying field redaction was actually applied).
   */
  storageUpload?: Record<string, (path: string, body: unknown) => { error: { message: string } | null }>;
  /**
   * Keyed by bucket name, resolving a .storage.from(bucket).list(...) call
   * — used by lib/admin/analytics.ts's storage-usage accounting. A single
   * Resolver applies to every .list() call for that bucket; return an
   * empty array on the second call in a paginated test to end the loop.
   */
  storageList?: Record<
    string,
    () => { data: { name: string; metadata: { size?: number } | null }[] | null; error: { message: string } | null }
  >;
}

export function createFakeDb(config: FakeDbConfig) {
  const fromCalls: string[] = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const storageDownloadCalls: Array<{ bucket: string; path: string }> = [];
  const fromCallCountByTable: Record<string, number> = {};
  const listCallCountByBucket: Record<string, number> = {};

  return {
    fromCalls,
    rpcCalls,
    storageDownloadCalls,
    from(table: string) {
      fromCalls.push(table);
      const configured = config.from?.[table];
      const callIndex = fromCallCountByTable[table] ?? 0;
      fromCallCountByTable[table] = callIndex + 1;

      let resolver: Resolver;
      if (Array.isArray(configured)) {
        resolver = configured[Math.min(callIndex, configured.length - 1)] ?? (() => ({ data: null, error: { message: `no fake configured for table ${table} call ${callIndex}` } }));
      } else {
        resolver = configured ?? (() => ({ data: null, error: { message: `no fake configured for table ${table}` } }));
      }
      return new FakeQueryBuilder(resolver);
    },
    rpc(fn: string, args?: unknown) {
      rpcCalls.push({ fn, args });
      const resolver = config.rpc?.[fn] ?? (() => ({ data: null, error: { message: `no fake configured for rpc ${fn}` } }));
      return new FakeQueryBuilder(resolver);
    },
    storage: {
      from(bucket: string) {
        return {
          download(path: string) {
            storageDownloadCalls.push({ bucket, path });
            const resolver = config.storage?.[bucket];
            if (!resolver) {
              return Promise.resolve({
                data: null,
                error: { message: `no fake configured for storage bucket ${bucket}` },
              });
            }
            return Promise.resolve(resolver(path));
          },
          createSignedUrl(path: string, ttlSeconds: number) {
            const resolver = config.storageSignedUrl?.[bucket];
            if (!resolver) {
              return Promise.resolve({
                data: null,
                error: { message: `no fake configured for signed-url bucket ${bucket}` },
              });
            }
            return Promise.resolve(resolver(path, ttlSeconds));
          },
          upload(path: string, body: unknown) {
            const resolver = config.storageUpload?.[bucket];
            if (!resolver) {
              return Promise.resolve({ error: { message: `no fake configured for upload bucket ${bucket}` } });
            }
            return Promise.resolve(resolver(path, body));
          },
          list() {
            const callIndex = listCallCountByBucket[bucket] ?? 0;
            listCallCountByBucket[bucket] = callIndex + 1;
            const resolver = config.storageList?.[bucket];
            if (!resolver) {
              return Promise.resolve({ data: [], error: null });
            }
            // Only the first call returns configured data; subsequent
            // calls return empty so a paginated .list() loop terminates —
            // matches this fake's "small, deterministic, test only needs
            // one page" scope for storage-usage accounting tests.
            return Promise.resolve(callIndex === 0 ? resolver() : { data: [], error: null });
          },
        };
      },
    },
  };
}
