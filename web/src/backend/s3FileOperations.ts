import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

import {
  listPrefixForPath,
  normalizeExplorerPath,
  objectKeyForPath,
} from "../cloud/s3Paths";

function folderMarkerKey(bucketPrefix: string, explorerPath: string, name: string): string {
  const key = objectKeyForPath(bucketPrefix, explorerPath, name);
  return key.endsWith("/") ? key : `${key}/`;
}

function isDescendantPath(child: string, ancestor: string): boolean {
  const c = normalizeExplorerPath(child);
  const a = normalizeExplorerPath(ancestor);
  if (!a) {
    return false;
  }
  return c === a || c.startsWith(`${a}/`);
}

async function headIsFile(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function listAllKeys(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: cursor,
      }),
    );
    for (const object of response.Contents ?? []) {
      if (object.Key) {
        keys.push(object.Key);
      }
    }
    cursor = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (cursor);
  return keys;
}

async function deleteExplorerPath(
  client: S3Client,
  bucket: string,
  bucketPrefix: string,
  explorerPath: string,
): Promise<void> {
  const fileKey = objectKeyForPath(
    bucketPrefix,
    explorerPath.split("/").slice(0, -1).join("/"),
    explorerPath.split("/").pop() ?? explorerPath,
  );
  if (await headIsFile(client, bucket, fileKey)) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey }));
    return;
  }
  const prefix = listPrefixForPath(bucketPrefix, explorerPath);
  const keys = await listAllKeys(client, bucket, prefix);
  for (const key of keys) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}

async function copyObjectKey(
  client: S3Client,
  bucket: string,
  sourceKey: string,
  destKey: string,
): Promise<void> {
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: destKey,
    }),
  );
}

async function copyExplorerPath(
  client: S3Client,
  bucket: string,
  bucketPrefix: string,
  sourcePath: string,
  destPath: string,
  overwrite: boolean,
): Promise<void> {
  if (isDescendantPath(destPath, sourcePath)) {
    throw new Error("cannot copy into itself or a descendant");
  }

  const sourceSegments = normalizeExplorerPath(sourcePath).split("/");
  const sourceName = sourceSegments.pop() ?? sourcePath;
  const sourceParent = sourceSegments.join("/");
  const sourceFileKey = objectKeyForPath(bucketPrefix, sourceParent, sourceName);

  const destSegments = normalizeExplorerPath(destPath).split("/");
  const destName = destSegments.pop() ?? destPath;
  const destParent = destSegments.join("/");
  const destFileKey = objectKeyForPath(bucketPrefix, destParent, destName);

  if (await headIsFile(client, bucket, sourceFileKey)) {
    if (!overwrite && (await headIsFile(client, bucket, destFileKey))) {
      throw new Error("path already exists");
    }
    if (overwrite) {
      await deleteExplorerPath(client, bucket, bucketPrefix, destPath);
    }
    await copyObjectKey(client, bucket, sourceFileKey, destFileKey);
    return;
  }

  const sourcePrefix = listPrefixForPath(bucketPrefix, sourcePath);
  const destPrefix = listPrefixForPath(bucketPrefix, destPath);
  const keys = await listAllKeys(client, bucket, sourcePrefix);
  if (keys.length === 0) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: destPrefix,
        Body: new Uint8Array(),
      }),
    );
    return;
  }

  for (const key of keys) {
    const suffix = key.slice(sourcePrefix.length);
    const targetKey = `${destPrefix}${suffix}`;
    if (!overwrite) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: targetKey }));
        throw new Error("path already exists");
      } catch (error) {
        if (error instanceof Error && error.message === "path already exists") {
          throw error;
        }
      }
    }
    await copyObjectKey(client, bucket, key, targetKey);
  }
}

export async function runS3FileAction(
  client: S3Client,
  bucket: string,
  bucketPrefix: string,
  params: import("./runActionParams").RunActionParams,
): Promise<void> {
  const { actionId, paths, destDir, newName, overwrite = false } = params;

  switch (actionId) {
    case "file.delete": {
      for (const path of paths) {
        await deleteExplorerPath(client, bucket, bucketPrefix, path);
      }
      return;
    }
    case "file.mkdir": {
      const parent = paths[0] ?? "";
      const name = newName?.trim();
      if (!name) {
        throw new Error("new_name is required");
      }
      const key = folderMarkerKey(bucketPrefix, parent, name);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: new Uint8Array(),
        }),
      );
      return;
    }
    case "file.rename": {
      const path = paths[0];
      const nextName = newName?.trim();
      if (!path || !nextName) {
        throw new Error("path and new_name are required");
      }
      const parent = normalizeExplorerPath(path).split("/").slice(0, -1).join("/");
      const destPath = parent ? `${parent}/${nextName}` : nextName;
      await copyExplorerPath(client, bucket, bucketPrefix, path, destPath, overwrite);
      await deleteExplorerPath(client, bucket, bucketPrefix, path);
      return;
    }
    case "file.copy": {
      if (!destDir) {
        throw new Error("dest_dir is required");
      }
      for (const source of paths) {
        const baseName = newName && paths.length === 1 ? newName : undefined;
        const segments = normalizeExplorerPath(source).split("/");
        const sourceName = baseName ?? segments.pop() ?? source;
        const destPath = normalizeExplorerPath(destDir)
          ? `${normalizeExplorerPath(destDir)}/${sourceName}`
          : sourceName;
        await copyExplorerPath(
          client,
          bucket,
          bucketPrefix,
          source,
          destPath,
          overwrite,
        );
      }
      return;
    }
    case "file.move": {
      if (!destDir) {
        throw new Error("dest_dir is required");
      }
      for (const source of paths) {
        const baseName = newName && paths.length === 1 ? newName : undefined;
        const segments = normalizeExplorerPath(source).split("/");
        const sourceName = baseName ?? segments.pop() ?? source;
        const destPath = normalizeExplorerPath(destDir)
          ? `${normalizeExplorerPath(destDir)}/${sourceName}`
          : sourceName;
        await copyExplorerPath(
          client,
          bucket,
          bucketPrefix,
          source,
          destPath,
          overwrite,
        );
        await deleteExplorerPath(client, bucket, bucketPrefix, source);
      }
      return;
    }
    default:
      throw new Error(`unknown action: ${actionId}`);
  }
}
