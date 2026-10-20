import { useState } from "react";

import { AppSection } from "./settings-app-section";
import { CollectionSection } from "./settings-collection-section";
import { DataSection } from "./settings-data-section";
import { GitHubSection } from "./settings-github-section";
import { LanguageSection } from "./settings-language-section";
import { SecuritySection } from "./settings-security-section";
import { StreamingSection } from "./settings-streaming-section";

export function SettingsPanel() {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      <LanguageSection />
      <CollectionSection />
      <StreamingSection />
      <SecuritySection />
      <DataSection onStatus={setStatus} />
      <GitHubSection onStatus={setStatus} />
      <AppSection onStatus={setStatus} />
      <p aria-live="polite" className="text-muted-foreground px-1 text-sm">
        {status}
      </p>
    </div>
  );
}
