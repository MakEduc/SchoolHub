export function signInErrorMessage(error: { code?: string; message?: string; status?: number }, audience: "student" | "teacher" = "teacher") {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "Supabase's email sending limit has been reached. Wait before trying again, or ask your administrator to configure custom SMTP in Supabase.";
    case "over_request_rate_limit":
      return "Too many sign-in attempts. Wait a few minutes before trying again.";
    case "email_address_not_authorized":
      return "Supabase's default email service cannot send to this address. Your administrator needs to configure custom SMTP in Supabase.";
    case "email_not_confirmed":
      return "Open your teacher invitation email and confirm your account first, then sign in.";
    case "signup_disabled":
    case "user_not_found":
      return audience === "student" ? "Student email sign-in is disabled. Your administrator needs to allow new users in Supabase Authentication." : "Use the email address from your teacher invitation. Ask your school administrator to invite you if you do not have an invitation.";
    case "email_provider_disabled":
    case "otp_disabled":
      return "Email sign-in is disabled. Your administrator needs to enable email sign-in in Supabase Authentication.";
    default:
      if (error.status === 429) return "Too many sign-in requests. Wait before trying again.";
      return error.message || "Could not send your sign-in link. Please try again.";
  }
}
