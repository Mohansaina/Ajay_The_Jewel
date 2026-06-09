import crypto from "crypto";

const base64UrlEncode = (str: string) => {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const base64UrlDecode = (str: string) => {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
};

export const signToken = (payload: any, secret: string, expiresInMinutes: number = 60 * 24): string => {
  const header = { alg: "HS256", typ: "JWT" };
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiration = issuedAt + expiresInMinutes * 60;
  
  const tokenPayload = {
    ...payload,
    iat: issuedAt,
    exp: expiration,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${encodedHeader}.${encodedPayload}`);
  const signature = base64UrlEncode(hmac.digest("base64"));

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export const verifyToken = (token: string, secret: string): any | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerStr, payloadStr, signatureStr] = parts;

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(`${headerStr}.${payloadStr}`);
    const calculatedSignature = base64UrlEncode(hmac.digest("base64"));

    if (calculatedSignature !== signatureStr) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadStr));
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && now > payload.exp) {
      return null; // Token expired
    }

    return payload;
  } catch (err) {
    return null;
  }
};
