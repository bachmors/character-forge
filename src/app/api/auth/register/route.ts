import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { hashPassword, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const db = await getDb();
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.collection("users").findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    const password_hash = await hashPassword(password);
    const user = {
      email: normalizedEmail,
      password_hash,
      role: "user" as const,
      created_at: new Date(),
      last_login_at: null,
    };
    const result = await db.collection("users").insertOne(user);
    await setAuthCookie({ _id: result.insertedId.toString(), email: normalizedEmail, role: "user" });
    return NextResponse.json({ email: normalizedEmail, role: "user" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
