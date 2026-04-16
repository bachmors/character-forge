import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { hashPassword, setAuthCookie } from "@/lib/auth";

const OWNER_EMAIL = "bachmorsartist@gmail.com";
const ACCESS_CODE = process.env.ACCESS_CODE!;

export async function POST(req: NextRequest) {
  try {
    const { accessCode, password } = await req.json();
    if (accessCode !== ACCESS_CODE) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 403 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const db = await getDb();
    const owner = await db.collection("users").findOne({ email: OWNER_EMAIL });
    if (!owner) {
      return NextResponse.json({ error: "Owner user not found. Run migration first." }, { status: 404 });
    }
    if (owner.password_hash) {
      return NextResponse.json({ error: "Owner already has a password. Use /api/auth/login." }, { status: 409 });
    }
    const password_hash = await hashPassword(password);
    await db.collection("users").updateOne({ _id: owner._id }, { $set: { password_hash, last_login_at: new Date() } });
    await setAuthCookie({ _id: owner._id.toString(), email: OWNER_EMAIL, role: "owner" });
    return NextResponse.json({ ok: true, email: OWNER_EMAIL });
  } catch (error) {
    console.error("POST /api/auth/first-time-setup error:", error);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
