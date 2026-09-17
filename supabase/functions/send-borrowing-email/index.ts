import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const subject: string | undefined = body.subject;
    const message: string | undefined = body.message;

    // Support both single recipient (recipientEmail) and multiple recipients (recipientEmails).
    // recipientEmails takes priority; if absent, fall back to recipientEmail.
    let recipients: string[] = [];
    if (Array.isArray(body.recipientEmails)) {
      recipients = body.recipientEmails.filter((e: unknown) => typeof e === "string" && e);
    }
    if (recipients.length === 0 && typeof body.recipientEmail === "string" && body.recipientEmail) {
      recipients = [body.recipientEmail];
    }

    if (recipients.length === 0 || !subject || !message) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "recipientEmail(s), subject, dan message wajib diisi",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("FROM_EMAIL");
    const fromName = Deno.env.get("FROM_NAME") ?? "Smart Sarpras";

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromEmail) {
      console.error(
        "[send-borrowing-email] Error: SMTP environment variables belum dikonfigurasi",
      );
      return new Response(
        JSON.stringify({
          success: false,
          message: "SMTP environment variables belum dikonfigurasi",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[send-borrowing-email] Email dimulai");
    console.log(`[send-borrowing-email] Mengirim ke: ${recipients.join(", ")}`);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.verify();
    console.log("[send-borrowing-email] SMTP terkoneksi");

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipients.join(", "),
      subject: subject,
      html: message,
    });

    console.log(
      `[send-borrowing-email] Email berhasil: ${info.messageId}`,
    );

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[send-borrowing-email] Error lengkap:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
