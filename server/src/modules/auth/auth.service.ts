import argon2 from "argon2";
import jwt, { type Secret } from "jsonwebtoken";
import { prisma } from "../../db/prisma";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing");
}

const jwtSecret: Secret = JWT_SECRET;

type AuthTokenPayload = {
  userId: string;
};

export function createAuthToken(userId: string) {
  const payload: AuthTokenPayload = { userId };

  return jwt.sign(payload, jwtSecret, {
    expiresIn: "7d",
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, jwtSecret);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("userId" in decoded) ||
    typeof decoded.userId !== "string"
  ) {
    throw new Error("Invalid token payload");
  }

  return {
    userId: decoded.userId,
  };
}

export function sanitizeUser(user: {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export async function signupUser(input: {
  username: string;
  email: string;
  password: string;
}) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { username: input.username }],
    },
  });

  if (existingUser) {
    throw new Error("Email or username already exists");
  }

  const passwordHash = await argon2.hash(input.password);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
    },
  });

  return sanitizeUser(user);
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (!user) {
    throw new Error("User does not exists");
  }

  const validPassword = await argon2.verify(user.passwordHash, input.password);

  if (!validPassword) {
    throw new Error("Invalid password");
  }

  return sanitizeUser(user);
}
