import { SettingsContainer } from "@/components/containers/SettingsContainer";
import { PageHeader } from "@/components/shared/States";
import { getSettings } from "@/lib/queries/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const data = await getSettings();
  return (
    <div>
      <PageHeader title="Settings" />
      <SettingsContainer data={data} />
    </div>
  );
}
