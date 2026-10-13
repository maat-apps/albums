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
import { setStreamingService } from "../../lib/app-settings";
import { STREAMING_SERVICES, type StreamingService } from "../../lib/streaming";

// Brand names, the same in every language.
const NAMES: Record<StreamingService, string> = {
  deezer: "Deezer",
  spotify: "Spotify",
  appleMusic: "Apple Music",
};

export function StreamingSection() {
  const { t } = useTranslation();
  const { streamingService } = useAppSettings();

  return (
    <SettingsSection title={t("streamingService")}>
      <SettingsRow
        title={t("streamingService")}
        description={t("streamingServiceDescription")}
        action={
          <Select
            value={streamingService}
            onValueChange={(value) =>
              setStreamingService(value as StreamingService)
            }
          >
            <SelectTrigger
              className="w-auto min-w-26 text-sm"
              aria-label={t("streamingService")}
            >
              <SelectValue>
                {(value) => NAMES[value as StreamingService]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STREAMING_SERVICES.map((service) => (
                <SelectItem key={service} value={service}>
                  {NAMES[service]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </SettingsSection>
  );
}
