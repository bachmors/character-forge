import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { comparePassword, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.password_hash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    await db.collection("users").updateOne({ _id: user._id }, { $set: { last_login_at: new Date() } });
    await setAuthCookie({ _id: user._id.toString(), email: user.email, role: user.role });
    return NextResponse.json({ email: user.email, role: user.role });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
