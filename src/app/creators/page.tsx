import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Creator jettons live on the launch page since the "Launch Creator Jetton" rebrand. */
export default function CreatorsPage() {
  redirect("/launch#creator-jettons");
}
