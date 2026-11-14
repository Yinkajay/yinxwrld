import type { Metadata } from "next";
import SettingsWorkspace from "@/app/components/settings-workspace";

export const metadata: Metadata = { title: "Settings | yinxwrld" };

export default function SettingsPage() {
  return <SettingsWorkspace />;
}
