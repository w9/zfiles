export type S3Provider = "aws" | "r2";

export type S3Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type S3ConnectionConfig = {
  provider: S3Provider;
  bucket: string;
  region: string;
  endpoint?: string;
  prefix: string;
  readOnly: boolean;
  credentials: S3Credentials;
};

export type S3BootParams = {
  provider?: S3Provider;
  bucket?: string;
  region?: string;
  endpoint?: string;
  prefix?: string;
  readOnly?: boolean;
};

export const S3_SESSION_STORAGE_KEY = "zfiles-s3-session";
