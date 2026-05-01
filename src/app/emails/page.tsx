import { redirect } from "next/navigation";

// Old /emails route — permanently redirect to the new Email Studio
export default function EmailsRedirect() {
  redirect("/email-templates");
}
