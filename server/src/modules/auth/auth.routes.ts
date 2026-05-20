import { Router } from "express";
import { loginSchema, signupSchema } from "./auth.schemas";
import { createAuthToken, loginUser, signupUser } from "./auth.service";
import { requireAuth } from "../../middleware/requireAuth";
import { authLimiter } from "../../middleware/rateLimiters";
import { env } from "../../config/env";

export const authRouter = Router();

const COOKIE_NAME = "meetly_token";

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.COOKIE_SECURE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

authRouter.post("/signup", authLimiter, async (req, res) => {
  try {
    const input = signupSchema.parse(req.body);

    const user = await signupUser(input);
    const token = createAuthToken(user.id);

    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.status(201).json({
      user,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create account";

    return res.status(400).json({
      message,
    });
  }
});

authRouter.post("/login", authLimiter, async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);

    const user = await loginUser(input);

    const token = createAuthToken(user.id);

    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.json({
      user,
    });
  } catch {
    return res.status(401).json({
      message: "Invalid email or password",
    });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, getCookieOptions());

  return res.json({
    message: "Logged out",
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  return res.json({
    user: req.user,
  });
});
