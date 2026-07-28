const RECIPIENT = "transactions@selloilroyaltiesnow.com";

function clean(value, limit = 4000) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function wantsJson(req) {
  return String(req.headers.accept || "").includes("application/json");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const honeypot = clean(body.website || body.company_website || "", 200);
  if (honeypot) {
    return res.status(200).json({ ok: true });
  }

  const lead = {
    name: clean(body.name, 160),
    email: clean(body.email, 240),
    phone: clean(body.phone, 80),
    countyState: clean(body.county_state, 200),
    ownerName: clean(body.owner_name, 200),
    operator: clean(body.operator, 200),
    wellStatus: clean(body.well_status, 240),
    message: clean(body.message, 5000),
  };

  if (!lead.name || !lead.email || !lead.phone || !lead.countyState || !lead.message) {
    const payload = { ok: false, error: "Please complete the required fields." };
    return wantsJson(req)
      ? res.status(400).json(payload)
      : res.redirect(303, "/contact?status=missing");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("Contact delivery is not configured.");
    const payload = { ok: false, error: "Delivery is temporarily unavailable." };
    return wantsJson(req)
      ? res.status(503).json(payload)
      : res.redirect(303, "/contact?status=unavailable");
  }

  const lines = [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `County and state: ${lead.countyState}`,
    `Owner name: ${lead.ownerName || "-"}`,
    `Operator or payor: ${lead.operator || "-"}`,
    `Well status: ${lead.wellStatus || "-"}`,
    "",
    lead.message,
  ];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [RECIPIENT],
      reply_to: lead.email,
      subject: `Oil royalty review — ${lead.countyState}`,
      text: lines.join("\n"),
    }),
  });

  if (!response.ok) {
    console.error("Contact delivery failed.", response.status);
    const payload = { ok: false, error: "Delivery is temporarily unavailable." };
    return wantsJson(req)
      ? res.status(502).json(payload)
      : res.redirect(303, "/contact?status=unavailable");
  }

  return wantsJson(req)
    ? res.status(200).json({ ok: true })
    : res.redirect(303, "/contact?status=sent");
}
