import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/i18n";
import { createS3Backend, validateS3Connection } from "@/backend/s3Backend";
import type { S3Backend } from "@/backend/s3Backend";
import { readBootParamsFromUrl } from "./bootParams";
import { saveSessionConfig } from "./credentials";
import ShareUrlButton from "./ShareUrlButton";
import { formToShareInput } from "./shareUrl";
import {
  readShareUrlIncludeCredentials,
  storeShareUrlIncludeCredentials,
} from "./shareUrlSettings";
import type { S3BootParams, S3ConnectionConfig, S3Provider } from "./types";

type ConnectDialogProps = {
  open: boolean;
  bootParams?: S3BootParams;
  onConnected: (backend: S3Backend) => void;
};

type FormState = {
  provider: S3Provider;
  bucket: string;
  region: string;
  endpoint: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  readOnly: boolean;
};

function initialForm(bootParams: S3BootParams): FormState {
  return {
    provider: bootParams.provider ?? "aws",
    bucket: bootParams.bucket ?? "",
    region: bootParams.region ?? "us-east-1",
    endpoint: bootParams.endpoint ?? "",
    prefix: bootParams.prefix ?? "",
    accessKeyId: bootParams.accessKeyId ?? "",
    secretAccessKey: bootParams.secretAccessKey ?? "",
    sessionToken: bootParams.sessionToken ?? "",
    readOnly: bootParams.readOnly ?? false,
  };
}

function toConfig(form: FormState): S3ConnectionConfig {
  return {
    provider: form.provider,
    bucket: form.bucket.trim(),
    region: form.region.trim(),
    endpoint: form.endpoint.trim() || undefined,
    prefix: form.prefix.trim(),
    readOnly: form.readOnly,
    credentials: {
      accessKeyId: form.accessKeyId.trim(),
      secretAccessKey: form.secretAccessKey.trim(),
      sessionToken: form.sessionToken.trim() || undefined,
    },
  };
}

export default function ConnectDialog({
  open,
  bootParams,
  onConnected,
}: ConnectDialogProps) {
  const { t } = useTranslation();
  const resolvedBoot = useMemo(
    () => bootParams ?? readBootParamsFromUrl(),
    [bootParams],
  );
  const [form, setForm] = useState<FormState>(() => initialForm(resolvedBoot));
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [includeCredentials, setIncludeCredentials] = useState(
    readShareUrlIncludeCredentials,
  );
  const autoConnectAttempted = useRef(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const connectWithConfig = async (config: S3ConnectionConfig) => {
    if (!config.bucket || !config.credentials.accessKeyId || !config.credentials.secretAccessKey) {
      throw new Error(t("connect.error.required"));
    }
    if (config.provider === "r2" && !config.endpoint) {
      throw new Error(t("connect.error.endpointRequired"));
    }
    await validateS3Connection(config);
    saveSessionConfig(config);
    onConnected(createS3Backend(config));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setConnecting(true);
    try {
      await connectWithConfig(toConfig(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (autoConnectAttempted.current) {
      return;
    }
    if (!resolvedBoot.accessKeyId || !resolvedBoot.secretAccessKey || !resolvedBoot.bucket) {
      return;
    }
    const config = toConfig(initialForm(resolvedBoot));
    if (config.provider === "r2" && !config.endpoint) {
      return;
    }
    autoConnectAttempted.current = true;
    setError(null);
    setConnecting(true);
    void connectWithConfig(config)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        autoConnectAttempted.current = false;
      })
      .finally(() => {
        setConnecting(false);
      });
  }, [resolvedBoot]);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <DialogTitle>{t("connect.title")}</DialogTitle>
            <DialogDescription>{t("connect.description")}</DialogDescription>
          </div>
          <ShareUrlButton
            input={formToShareInput(form)}
            includeCredentials={includeCredentials}
          />
        </DialogHeader>
        <form onSubmit={(event) => void onSubmit(event)}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="connect-provider">{t("connect.provider")}</FieldLabel>
              <Select
                value={form.provider}
                onValueChange={(value) => update("provider", value as S3Provider)}
              >
                <SelectTrigger id="connect-provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aws">{t("connect.provider.aws")}</SelectItem>
                  <SelectItem value="r2">{t("connect.provider.r2")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="connect-bucket">{t("connect.bucket")}</FieldLabel>
              <Input
                id="connect-bucket"
                value={form.bucket}
                onChange={(event) => update("bucket", event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="connect-region">{t("connect.region")}</FieldLabel>
              <Input
                id="connect-region"
                value={form.region}
                onChange={(event) => update("region", event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="connect-endpoint">{t("connect.endpoint")}</FieldLabel>
              <Input
                id="connect-endpoint"
                value={form.endpoint}
                onChange={(event) => update("endpoint", event.target.value)}
                placeholder={
                  form.provider === "r2"
                    ? "https://<account-id>.r2.cloudflarestorage.com"
                    : t("connect.endpointOptional")
                }
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="connect-prefix">{t("connect.prefix")}</FieldLabel>
              <Input
                id="connect-prefix"
                value={form.prefix}
                onChange={(event) => update("prefix", event.target.value)}
                placeholder="optional/path/prefix/"
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="connect-access-key">{t("connect.accessKeyId")}</FieldLabel>
              <Input
                id="connect-access-key"
                value={form.accessKeyId}
                onChange={(event) => update("accessKeyId", event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="connect-secret-key">{t("connect.secretAccessKey")}</FieldLabel>
              <Input
                id="connect-secret-key"
                type="password"
                value={form.secretAccessKey}
                onChange={(event) => update("secretAccessKey", event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="connect-session-token">{t("connect.sessionToken")}</FieldLabel>
              <Input
                id="connect-session-token"
                type="password"
                value={form.sessionToken}
                onChange={(event) => update("sessionToken", event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="connect-read-only"
                checked={form.readOnly}
                onCheckedChange={(checked) => update("readOnly", checked === true)}
              />
              <FieldLabel htmlFor="connect-read-only">{t("connect.readOnly")}</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="connect-include-credentials"
                checked={includeCredentials}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setIncludeCredentials(next);
                  storeShareUrlIncludeCredentials(next);
                }}
              />
              <FieldLabel htmlFor="connect-include-credentials">
                {t("connect.shareUrl.includeCredentials")}
              </FieldLabel>
            </Field>
            <FieldDescription className="text-xs">{t("connect.privacy")}</FieldDescription>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button type="submit" disabled={connecting}>
                {connecting ? t("connect.connecting") : t("connect.submit")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
