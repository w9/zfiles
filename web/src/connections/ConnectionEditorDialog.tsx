import { useState } from "react";

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
import { isCloudCredentialsAuthError } from "@/cloud/s3AuthError";
import ShareUrlButton from "@/cloud/ShareUrlButton";
import { formToShareInput } from "@/cloud/shareUrl";
import {
  readShareUrlIncludeCredentials,
  storeShareUrlIncludeCredentials,
} from "@/cloud/shareUrlSettings";
import type { S3Provider } from "@/cloud/types";

export type ConnectionEditorMode = "create" | "edit" | "credentials";

export type ConnectionFormValues = {
  name: string;
  provider: S3Provider;
  bucket: string;
  region: string;
  endpoint: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  readOnly: boolean;
  rememberKeys: boolean;
};

type ConnectionEditorDialogProps = {
  open: boolean;
  mode: ConnectionEditorMode;
  initial?: Partial<ConnectionFormValues>;
  onCancel: () => void;
  onSubmit: (values: ConnectionFormValues) => Promise<void>;
};

export function emptyConnectionForm(): ConnectionFormValues {
  return {
    name: "",
    provider: "aws",
    bucket: "",
    region: "us-east-1",
    endpoint: "",
    prefix: "",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    readOnly: false,
    rememberKeys: false,
  };
}

function initialForm(initial?: Partial<ConnectionFormValues>): ConnectionFormValues {
  return { ...emptyConnectionForm(), ...initial };
}

export default function ConnectionEditorDialog({
  open,
  mode,
  initial,
  onCancel,
  onSubmit,
}: ConnectionEditorDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ConnectionFormValues>(() => initialForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [includeCredentials, setIncludeCredentials] = useState(
    readShareUrlIncludeCredentials,
  );

  const keysOnly = mode === "credentials";
  const update = <K extends keyof ConnectionFormValues>(
    key: K,
    value: ConnectionFormValues[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validate = (values: ConnectionFormValues): string | null => {
    const needsKeys = mode !== "edit";
    if (!keysOnly && !values.bucket.trim()) {
      return t("connect.error.required");
    }
    if (needsKeys && (!values.accessKeyId.trim() || !values.secretAccessKey.trim())) {
      return t("connect.error.required");
    }
    if (!keysOnly && values.provider === "r2" && !values.endpoint.trim()) {
      return t("connect.error.endpointRequired");
    }
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = validate(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(
        isCloudCredentialsAuthError(err)
          ? t("connect.authExpired.toast")
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "create"
      ? t("connect.title")
      : mode === "edit"
        ? t("connect.editTitle")
        : t("connect.credentialsTitle");
  const submitLabel = mode === "edit" ? t("connect.save") : t("connect.submit");

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      {/* The full settings form is taller than short viewports, so it scrolls. */}
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {keysOnly
                ? t("connect.credentialsDescription", { name: form.name || form.bucket })
                : t("connect.description")}
            </DialogDescription>
          </div>
          {keysOnly ? null : (
            <ShareUrlButton
              input={formToShareInput(form)}
              includeCredentials={includeCredentials}
            />
          )}
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup className="gap-4">
            {keysOnly ? null : (
              <>
                <Field>
                  <FieldLabel htmlFor="connect-name">{t("connect.name")}</FieldLabel>
                  <Input
                    id="connect-name"
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder={t("connect.namePlaceholder")}
                    autoComplete="off"
                  />
                </Field>
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
              </>
            )}
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
              <FieldLabel htmlFor="connect-secret-key">
                {t("connect.secretAccessKey")}
              </FieldLabel>
              <Input
                id="connect-secret-key"
                type="password"
                value={form.secretAccessKey}
                onChange={(event) => update("secretAccessKey", event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="connect-session-token">
                {t("connect.sessionToken")}
              </FieldLabel>
              <Input
                id="connect-session-token"
                type="password"
                value={form.sessionToken}
                onChange={(event) => update("sessionToken", event.target.value)}
                autoComplete="off"
              />
            </Field>
            {keysOnly ? null : (
              <Field orientation="horizontal">
                <Checkbox
                  id="connect-read-only"
                  checked={form.readOnly}
                  onCheckedChange={(checked) => update("readOnly", checked === true)}
                />
                <FieldLabel htmlFor="connect-read-only">{t("connect.readOnly")}</FieldLabel>
              </Field>
            )}
            <Field orientation="horizontal">
              <Checkbox
                id="connect-remember-keys"
                checked={form.rememberKeys}
                onCheckedChange={(checked) => update("rememberKeys", checked === true)}
              />
              <FieldLabel htmlFor="connect-remember-keys">
                {t("connect.rememberKeys")}
              </FieldLabel>
            </Field>
            <FieldDescription className="text-xs">
              {form.rememberKeys ? t("connect.rememberKeysHint") : t("connect.privacy")}
            </FieldDescription>
            {keysOnly ? null : (
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
            )}
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                {t("connect.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? t("connect.connecting") : submitLabel}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
