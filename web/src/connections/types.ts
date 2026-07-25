import type { S3ConnectionSettings, S3Credentials } from "../cloud/types";

/**
 * Every volume the explorer can mount is a connection: the always-present browser
 * filesystem, saved S3/R2 buckets, and (in the CLI build) the local zfiles server.
 */
export type ConnectionKind = "browser" | "s3" | "kernel";

export type ConnectionRecord = {
  id: string;
  kind: ConnectionKind;
  name: string;
  createdAt: number;
  lastUsedAt?: number;
  rememberKeys: boolean;
  settings?: S3ConnectionSettings;
};

export type CreateConnectionInput = {
  name?: string;
  settings: S3ConnectionSettings;
  credentials?: S3Credentials;
  rememberKeys?: boolean;
};

export type UpdateConnectionInput = {
  name?: string;
  settings?: S3ConnectionSettings;
  credentials?: S3Credentials;
  rememberKeys?: boolean;
};
