export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderID } = req.body || {};

    if (!orderID) {
      return res.status(400).json({ error: "Missing orderID" });
    }

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return res.status(500).json({
        error: "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in Vercel env"
      });
    }

    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const tokenText = await tokenRes.text();
    let tokenData = {};
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      tokenData = { raw: tokenText };
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(500).json({
        error: "Failed to get PayPal access token",
        paypal: tokenData
      });
    }

    const captureRes = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const captureText = await captureRes.text();
    let captureData = {};
    try {
      captureData = JSON.parse(captureText);
    } catch {
      captureData = { raw: captureText };
    }

    if (!captureRes.ok) {
      return res.status(500).json({
        error: "Failed to capture PayPal order",
        paypal: captureData
      });
    }

    return res.status(200).json({
      success: true,
      orderID,
      details: captureData
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while capturing PayPal order",
      details: error?.message || String(error)
    });
  }
}
