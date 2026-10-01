import { MobileGate } from "@maat-apps/ui/mobile-gate";
import { useTranslation } from "../i18n/use-translation";
import { AppRouter } from "./router";

export function Root() {
  const { t } = useTranslation();
  return (
    <MobileGate message={t("desktopNotSupported")}>
      <AppRouter />
    </MobileGate>
  );
}
