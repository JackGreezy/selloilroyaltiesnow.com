const SITE = {
  businessName: "Sell Oil Royalties",
  businessEmail: "transactions@selloilroyaltiesnow.com",
  siteUrl: "https://selloilroyaltiesnow.com",
};

const WINDOW_MS = 60 * 1000;
const REQUEST_LIMIT = 6;
const buckets = new Map();

const clean = (value, limit = 5000) =>
  String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);

const escapeHtml = (value) =>
  clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.end();
}

function wantsJson(req) {
  return String(req.headers.accept || "").includes("application/json");
}

function rateLimit(req) {
  const key =
    clean(req.headers["cf-connecting-ip"]) ||
    clean(String(req.headers["x-forwarded-for"] || "").split(",")[0]) ||
    clean(req.headers["x-real-ip"]) ||
    "unknown";
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, reset: now + WINDOW_MS };
  if (bucket.reset <= now) {
    bucket.count = 0;
    bucket.reset = now + WINDOW_MS;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= REQUEST_LIMIT;
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      if (clean(req.headers["content-type"]).toLowerCase().includes("application/json")) {
        resolve(raw ? JSON.parse(raw) : {});
      } else {
        resolve(Object.fromEntries(new URLSearchParams(raw).entries()));
      }
    });
    req.on("error", reject);
  });
}

function leadFrom(body, req) {
  return {
    name: clean(body.name, 160),
    email: clean(body.email, 240),
    phone: clean(body.phone, 80),
    countyState: clean(body.county_state, 200),
    ownerName: clean(body.owner_name, 200),
    operator: clean(body.operator, 200),
    wellStatus: clean(body.well_status, 240),
    message: clean(body.message),
    honeypot: clean(body.website || body.company_website, 200),
    source: clean(req.headers.referer || `${SITE.siteUrl}/contact`, 500),
  };
}

function invalid(lead) {
  if (!lead.name || !lead.email || !lead.phone || !lead.countyState || !lead.message) {
    return "Please complete each required field.";
  }
  if (!/^\S+@\S+\.\S+$/.test(lead.email)) return "Please enter a valid email address.";
  if (lead.phone.replace(/\D/g, "").length < 7) return "Please enter a valid phone number.";
  return "";
}

function solicitation(lead) {
  const text = Object.values(lead).join(" ").toLowerCase();
  const pitches = [
    "guest post",
    "link building",
    "backlinks",
    "domain authority",
    "seo services",
    "web design services",
    "first page of google",
    "marketing agency",
    "crypto investment",
  ];
  return (
    Boolean(lead.honeypot) ||
    pitches.some((term) => text.includes(term)) ||
    (text.match(/https?:\/\//g) || []).length > 2
  );
}

async function sendEmail(to, lead) {
  const apiKey = clean(process.env.SENDGRID_API_KEY);
  if (!apiKey) throw new Error("SENDGRID_API_KEY is missing");

  const from = clean(process.env.SENDGRID_FROM_EMAIL) || SITE.businessEmail;
  const fromName = clean(process.env.SENDGRID_FROM_NAME) || SITE.businessName;
  const rows = [
    ["Owner or contact", lead.name],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["County and state", lead.countyState],
    ["Name on statement", lead.ownerName || "Not provided"],
    ["Operator or payor", lead.operator || "Not provided"],
    ["Well status", lead.wellStatus || "Not provided"],
    ["Decision being considered", lead.message],
    ["Source", lead.source],
  ];
  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = rows
    .map(
      ([label, value]) =>
        `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
    )
    .join("");

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: from, name: fromName },
      reply_to: { email: lead.email, name: lead.name },
      personalizations: [{ to: [{ email: to }] }],
      subject: `Oil royalty review: ${lead.countyState}`,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
      categories: ["mineral-rights-lead", "selloilroyaltiesnow-com"],
    }),
  });
  if (!response.ok) throw new Error(`SendGrid request failed (${response.status})`);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }
  if (!rateLimit(req)) {
    return json(res, 429, { ok: false, error: "Please wait before trying again." });
  }

  try {
    const lead = leadFrom(await readBody(req), req);
    const error = invalid(lead);
    if (error) {
      return wantsJson(req)
        ? json(res, 400, { ok: false, error })
        : redirect(res, "/contact?status=missing");
    }
    if (!solicitation(lead)) {
      const recipients = clean(
        process.env.CONTACT_NOTIFICATION_RECIPIENTS || SITE.businessEmail,
      )
        .split(/[\n,;]/)
        .map(clean)
        .filter(Boolean);
      await Promise.all([...new Set(recipients)].map((to) => sendEmail(to, lead)));
    }
    return wantsJson(req)
      ? json(res, 200, { ok: true })
      : redirect(res, "/contact?status=sent");
  } catch (error) {
    console.error(error);
    return wantsJson(req)
      ? json(res, 500, {
          ok: false,
          error: "The royalty review request could not be submitted.",
        })
      : redirect(res, "/contact?status=unavailable");
  }
};
