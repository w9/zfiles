import {
  BLOBS_STORE,
  BROWSER_FS_DATABASE_NAME,
  NODES_STORE,
  PARENT_INDEX,
  openBrowserFsDatabase,
  requestResult,
  transactionComplete,
  type BrowserFsBlobRecord,
  type BrowserFsNode,
} from "./db";
import { BrowserFsError, toBrowserFsError } from "./errors";
import {
  descendantPrefix,
  isValidPath,
  normalizePath,
  pathIsWithin,
  pathName,
  pathParent,
  pathSegments,
} from "./paths";

export type BrowserFsStoreOptions = {
  factory?: IDBFactory;
  databaseName?: string;
  now?: () => number;
  createId?: () => string;
};

export type WriteFileOptions = {
  contentType?: string;
};

export type TransferOptions = {
  overwrite?: boolean;
};

type TxContext = {
  nodes: IDBObjectStore;
  blobs: IDBObjectStore;
};

/** Upper bound for a path prefix scan; no BMP code unit sorts above U+FFFF. */
const MAX_KEY_SUFFIX = "\uffff";

function getNode(ctx: TxContext, path: string): Promise<BrowserFsNode | null> {
  return requestResult(ctx.nodes.get(path) as IDBRequest<BrowserFsNode | undefined>).then(
    (node) => node ?? null,
  );
}

function childNodes(ctx: TxContext, parent: string): Promise<BrowserFsNode[]> {
  return requestResult(
    ctx.nodes.index(PARENT_INDEX).getAll(IDBKeyRange.only(parent)) as IDBRequest<
      BrowserFsNode[]
    >,
  );
}

function subtreeNodes(ctx: TxContext, path: string): Promise<BrowserFsNode[]> {
  const prefix = descendantPrefix(path);
  if (!prefix) {
    return requestResult(ctx.nodes.getAll() as IDBRequest<BrowserFsNode[]>);
  }
  return requestResult(
    ctx.nodes.getAll(IDBKeyRange.bound(prefix, `${prefix}${MAX_KEY_SUFFIX}`)) as IDBRequest<
      BrowserFsNode[]
    >,
  );
}

async function deleteSubtree(ctx: TxContext, path: string): Promise<void> {
  const node = await getNode(ctx, path);
  const nodes = node ? [node, ...(await subtreeNodes(ctx, path))] : [];
  for (const entry of nodes) {
    if (entry.blobId) {
      await requestResult(ctx.blobs.delete(entry.blobId));
    }
    await requestResult(ctx.nodes.delete(entry.path));
  }
}

async function assertParentDirectory(ctx: TxContext, path: string): Promise<void> {
  const parent = pathParent(path);
  if (!parent) {
    return;
  }
  const node = await getNode(ctx, parent);
  if (!node) {
    throw new BrowserFsError("not-found", `no such directory: ${parent}`);
  }
  if (!node.is_dir) {
    throw new BrowserFsError("already-exists", `not a directory: ${parent}`);
  }
}

export class BrowserFsStore {
  private readonly factory: IDBFactory | undefined;
  private readonly databaseName: string;
  private readonly now: () => number;
  private readonly createId: () => string;
  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;

  constructor(options: BrowserFsStoreOptions = {}) {
    this.factory =
      options.factory ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);
    this.databaseName = options.databaseName ?? BROWSER_FS_DATABASE_NAME;
    this.now = options.now ?? (() => Date.now());
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  async listChildren(path: string): Promise<BrowserFsNode[]> {
    const target = normalizePath(path);
    return this.run("readonly", async (ctx) => {
      if (target) {
        const node = await getNode(ctx, target);
        if (!node) {
          throw new BrowserFsError("not-found", `no such directory: ${target}`);
        }
        if (!node.is_dir) {
          throw new BrowserFsError("already-exists", `not a directory: ${target}`);
        }
      }
      return childNodes(ctx, target);
    });
  }

  getNode(path: string): Promise<BrowserFsNode | null> {
    const target = normalizePath(path);
    return this.run("readonly", (ctx) => getNode(ctx, target));
  }

  async readBlob(path: string): Promise<Blob> {
    const target = normalizePath(path);
    return this.run("readonly", async (ctx) => {
      const node = await getNode(ctx, target);
      if (!node || node.is_dir || !node.blobId) {
        throw new BrowserFsError("not-found", `no such file: ${target}`);
      }
      const record = await requestResult(
        ctx.blobs.get(node.blobId) as IDBRequest<BrowserFsBlobRecord | undefined>,
      );
      if (!record) {
        throw new BrowserFsError("not-found", `missing contents for ${target}`);
      }
      return record.blob;
    });
  }

  async writeFile(
    path: string,
    blob: Blob,
    options: WriteFileOptions = {},
  ): Promise<BrowserFsNode> {
    const target = this.requireWritablePath(path);
    return this.run("readwrite", async (ctx) => {
      await this.ensureDirectory(ctx, pathParent(target));
      const existing = await getNode(ctx, target);
      if (existing?.is_dir) {
        throw new BrowserFsError("already-exists", `directory exists at ${target}`);
      }
      if (existing?.blobId) {
        await requestResult(ctx.blobs.delete(existing.blobId));
      }
      const blobId = this.createId();
      await requestResult(ctx.blobs.put({ id: blobId, blob }));
      const node: BrowserFsNode = {
        path: target,
        parent: pathParent(target),
        name: pathName(target),
        is_dir: false,
        size: blob.size,
        modified: this.now(),
        contentType: options.contentType ?? (blob.type || undefined),
        blobId,
      };
      await requestResult(ctx.nodes.put(node));
      return node;
    });
  }

  async makeDirectory(path: string): Promise<BrowserFsNode> {
    const target = this.requireWritablePath(path);
    return this.run("readwrite", async (ctx) => {
      const existing = await getNode(ctx, target);
      if (existing) {
        throw new BrowserFsError("already-exists", `already exists: ${target}`);
      }
      await this.ensureDirectory(ctx, pathParent(target));
      return this.putDirectory(ctx, target);
    });
  }

  async remove(paths: string[]): Promise<void> {
    const targets = paths.map((path) => this.requireWritablePath(path));
    await this.run("readwrite", async (ctx) => {
      for (const target of targets) {
        const node = await getNode(ctx, target);
        if (!node) {
          throw new BrowserFsError("not-found", `no such entry: ${target}`);
        }
        await deleteSubtree(ctx, target);
      }
    });
  }

  async move(source: string, dest: string, options: TransferOptions = {}): Promise<void> {
    const { from, to } = this.requireTransferPaths(source, dest);
    await this.run("readwrite", async (ctx) => {
      const node = await this.prepareTransfer(ctx, from, to, options.overwrite ?? false);
      const descendants = await subtreeNodes(ctx, from);
      await requestResult(ctx.nodes.delete(from));
      await requestResult(ctx.nodes.put(this.relocate(node, to)));
      for (const child of descendants) {
        const nextPath = `${to}${child.path.slice(from.length)}`;
        await requestResult(ctx.nodes.delete(child.path));
        await requestResult(ctx.nodes.put(this.relocate(child, nextPath)));
      }
    });
  }

  async copy(source: string, dest: string, options: TransferOptions = {}): Promise<void> {
    const { from, to } = this.requireTransferPaths(source, dest);
    await this.run("readwrite", async (ctx) => {
      const node = await this.prepareTransfer(ctx, from, to, options.overwrite ?? false);
      const descendants = await subtreeNodes(ctx, from);
      await this.cloneNode(ctx, node, to);
      for (const child of descendants) {
        await this.cloneNode(ctx, child, `${to}${child.path.slice(from.length)}`);
      }
    });
  }

  /** Total size of stored files; directories do not consume space of their own. */
  async usageBytes(): Promise<number> {
    return this.run("readonly", async (ctx) => {
      const nodes = await requestResult(ctx.nodes.getAll() as IDBRequest<BrowserFsNode[]>);
      return nodes.reduce((total, node) => (node.is_dir ? total : total + node.size), 0);
    });
  }

  countBlobs(): Promise<number> {
    return this.run("readonly", (ctx) => requestResult(ctx.blobs.count()));
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.opening = null;
  }

  private requireWritablePath(path: string): string {
    const target = normalizePath(path);
    if (!target || !isValidPath(target)) {
      throw new BrowserFsError("invalid-name", `invalid path: ${path}`);
    }
    return target;
  }

  private requireTransferPaths(source: string, dest: string): { from: string; to: string } {
    const from = this.requireWritablePath(source);
    const to = this.requireWritablePath(dest);
    if (pathIsWithin(to, from)) {
      throw new BrowserFsError("into-descendant", `cannot move ${from} into itself`);
    }
    return { from, to };
  }

  private async prepareTransfer(
    ctx: TxContext,
    from: string,
    to: string,
    overwrite: boolean,
  ): Promise<BrowserFsNode> {
    const node = await getNode(ctx, from);
    if (!node) {
      throw new BrowserFsError("not-found", `no such entry: ${from}`);
    }
    await assertParentDirectory(ctx, to);
    const existing = await getNode(ctx, to);
    if (existing) {
      if (!overwrite) {
        throw new BrowserFsError("already-exists", `already exists: ${to}`);
      }
      await deleteSubtree(ctx, to);
    }
    return node;
  }

  private relocate(node: BrowserFsNode, nextPath: string): BrowserFsNode {
    return {
      ...node,
      path: nextPath,
      parent: pathParent(nextPath),
      name: pathName(nextPath),
    };
  }

  private async cloneNode(
    ctx: TxContext,
    node: BrowserFsNode,
    nextPath: string,
  ): Promise<void> {
    const clone = this.relocate(node, nextPath);
    if (node.blobId) {
      const record = await requestResult(
        ctx.blobs.get(node.blobId) as IDBRequest<BrowserFsBlobRecord | undefined>,
      );
      clone.blobId = this.createId();
      await requestResult(ctx.blobs.put({ id: clone.blobId, blob: record?.blob ?? new Blob() }));
    }
    await requestResult(ctx.nodes.put(clone));
  }

  private async ensureDirectory(ctx: TxContext, path: string): Promise<void> {
    let current = "";
    for (const segment of pathSegments(path)) {
      current = current ? `${current}/${segment}` : segment;
      const node = await getNode(ctx, current);
      if (!node) {
        await this.putDirectory(ctx, current);
      } else if (!node.is_dir) {
        throw new BrowserFsError("already-exists", `not a directory: ${current}`);
      }
    }
  }

  private async putDirectory(ctx: TxContext, path: string): Promise<BrowserFsNode> {
    const node: BrowserFsNode = {
      path,
      parent: pathParent(path),
      name: pathName(path),
      is_dir: true,
      size: 0,
      modified: this.now(),
    };
    await requestResult(ctx.nodes.put(node));
    return node;
  }

  private open(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }
    if (!this.opening) {
      const factory = this.factory;
      if (!factory) {
        return Promise.reject(
          new BrowserFsError("unavailable", "IndexedDB is not available in this browser"),
        );
      }
      this.opening = openBrowserFsDatabase(factory, this.databaseName)
        .then((db) => {
          this.db = db;
          return db;
        })
        .catch((err: unknown) => {
          this.opening = null;
          throw toBrowserFsError(err);
        });
    }
    return this.opening;
  }

  /**
   * IndexedDB transactions stay alive only while their own requests are pending, so
   * everything inside `body` must await IndexedDB work and nothing else.
   */
  private async run<T>(
    mode: IDBTransactionMode,
    body: (ctx: TxContext) => Promise<T>,
  ): Promise<T> {
    const db = await this.open();
    const transaction = db.transaction([NODES_STORE, BLOBS_STORE], mode);
    const completed = transactionComplete(transaction);
    const ctx: TxContext = {
      nodes: transaction.objectStore(NODES_STORE),
      blobs: transaction.objectStore(BLOBS_STORE),
    };

    let result: T;
    try {
      result = await body(ctx);
    } catch (err) {
      completed.catch(() => {});
      try {
        transaction.abort();
      } catch {
        // Transaction already finished; the original error is what matters.
      }
      throw toBrowserFsError(err);
    }

    try {
      await completed;
    } catch (err) {
      throw toBrowserFsError(err);
    }
    return result;
  }
}

export function createBrowserFsStore(options?: BrowserFsStoreOptions): BrowserFsStore {
  return new BrowserFsStore(options);
}
