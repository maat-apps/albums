import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@maat-apps/ui/drawer";
import { useTranslation } from "../../i18n/use-translation";

import { SettingsPanel } from "./settings-panel";

/** Settings as a bottom drawer over the collection, as in routines. */
export function SettingsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent
        // `--popover` and `--card` are the same colour, so on the default
        // drawer surface the settings rows would lose their card edges.
        className="bg-background [--drawer-bleed-background:var(--color-background)]"
      >
        <DrawerHeader className="group-data-[swipe-axis=y]/drawer-popup:text-left">
          <DrawerTitle>{t("settings")}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <SettingsPanel />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
