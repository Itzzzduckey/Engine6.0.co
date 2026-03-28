export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { product, license, price } = req.body || {};

    if (!product || !license || !price) {
      return res.status(400).json({ error: "Missing product, license, or price" });
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

    const orderRes = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: `${product} - ${license}`,
            amount: {
              currency_code: "USD",
              value: price
            }
          }
        ]
      })
    });

    const orderText = await orderRes.text();
    let orderData = {};
    try {
      orderData = JSON.parse(orderText);
    } catch {
      orderData = { raw: orderText };
    }

    if (!orderRes.ok || !orderData.id) {
      return res.status(500).json({
        error: "Failed to create PayPal order",
        paypal: orderData
      });
    }

    return res.status(200).json({ id: orderData.id });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while creating PayPal order",
      details: error?.message || String(error)
    });
  }
}
