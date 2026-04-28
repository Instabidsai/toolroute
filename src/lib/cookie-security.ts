import type { NextResponse } from "next/server";

export type SecureCookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
};

const IS_PROD = process.env.NODE_ENV === "production";

export function setSecureCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: SecureCookieOptions = {}
): void {
  response.cookies.set(name, value, {
    ...options,
    httpOnly: true,
    secure: options.secure ?? IS_PROD,
    sameSite: options.sameSite ?? "lax",
    path: options.path ?? "/",
  });
}

export function deleteSecureCookie(
  response: NextResponse,
  name: string,
  options: Pick<SecureCookieOptions, "domain" | "path"> = {}
): void {
  response.cookies.set(name, "", {
    ...options,
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: options.path ?? "/",
    maxAge: 0,
  });
}
