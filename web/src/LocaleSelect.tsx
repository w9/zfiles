import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALE_LABEL_KEYS } from "@/i18n/localeLabels";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n";

type LocaleSelectProps = {
  value: Locale;
  onValueChange: (locale: Locale) => void;
  labelForKey: (key: string) => string;
  id?: string;
};

export default function LocaleSelect({
  value,
  onValueChange,
  labelForKey,
  id,
}: LocaleSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as Locale)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[60vh]">
        {SUPPORTED_LOCALES.map((option) => (
          <SelectItem key={option} value={option}>
            {labelForKey(LOCALE_LABEL_KEYS[option])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
