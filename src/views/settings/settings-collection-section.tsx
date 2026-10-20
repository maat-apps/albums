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
import { useAppSettings } from "../../hooks/use-app-settings";
import { useTranslation } from "../../i18n/use-translation";
import { setCollectionPrefs, type ViewMode } from "../../lib/app-settings";

const VIEW_MODES: ViewMode[] = ["grid", "list"];

/** Grid or list on the home screen; remembered across launches. */
export function CollectionSection() {
  const { t } = useTranslation();
  const { collection } = useAppSettings();
  const label: Record<ViewMode, string> = {
    grid: t("viewModeGrid"),
    list: t("viewModeList"),
  };

  return (
    <SettingsSection title={t("collection")}>
      <SettingsRow
        title={t("viewMode")}
        description={t("viewModeDescription")}
        action={
          <Select
            value={collection.viewMode}
            onValueChange={(value) =>
              setCollectionPrefs({ viewMode: value as ViewMode })
            }
          >
            <SelectTrigger
              className="w-auto min-w-26 text-sm"
              aria-label={t("viewMode")}
            >
              <SelectValue>{(value) => label[value as ViewMode]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VIEW_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {label[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </SettingsSection>
  );
}
