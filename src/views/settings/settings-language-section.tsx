import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maat-apps/ui/select";
import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";
import { useTranslation } from "../../i18n/use-translation";

export function LanguageSection() {
  const { t, locale, setLocale } = useTranslation();

  return (
    <SettingsSection title={t("language")}>
      <SettingsRow
        title={t("language")}
        description={locale === "pl" ? "Polski" : "English"}
        action={
          <Select
            value={locale}
            onValueChange={(value) => setLocale(value as "pl" | "en")}
          >
            <SelectTrigger
              className="h-8.5 w-auto min-w-26 text-sm"
              aria-label={t("language")}
            >
              <SelectValue>
                {(value) => (value === "en" ? "English" : "Polski")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pl">Polski</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </SettingsSection>
  );
}
