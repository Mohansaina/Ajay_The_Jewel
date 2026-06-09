import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../lib/auth-server";

export default async function RootPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
