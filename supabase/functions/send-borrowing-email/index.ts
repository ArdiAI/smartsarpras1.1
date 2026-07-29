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
    const { recipientEmail, subject, message } = await req.json();

    if (!recipientEmail || !subject || !message) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "recipientEmail, subject, dan message wajib diisi",
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
    console.log(`[send-borrowing-email] Mengirim ke: ${recipientEmail}`);

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
      to: recipientEmail,
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
