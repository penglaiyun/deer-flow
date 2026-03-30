import { cookies } from "next/headers";

import { STUDIO_SIDEBAR_COLLAPSED_KEY } from "@/components/studio/constants";
import { StudioLayout } from "@/components/studio/studio-layout";

export const dynamic = "force-dynamic";

export default async function ProjectsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(STUDIO_SIDEBAR_COLLAPSED_KEY)?.value;
  const initialSidebarCollapsed = sidebarCookie === "true";
  return (
    <StudioLayout initialSidebarCollapsed={initialSidebarCollapsed}>
      {children}
    </StudioLayout>
  );
}
