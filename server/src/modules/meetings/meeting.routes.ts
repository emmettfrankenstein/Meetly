import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middleware/requireAuth";

export const meetingRouter = Router();

const createMeetingSchema = z.object({
  title: z.string().max(100).optional(),
  passcode: z.string().trim().optional(),
  // isE2eeEnabled: z.boolean().optional(),
});

const verifyPasscodeSchema = z.object({
  passcode: z.string().min(1),
});

function createRoomId() {
  return crypto.randomUUID().slice(0, 8);
}

function createPasscode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

meetingRouter.use(requireAuth);

meetingRouter.post("/", async (req, res) => {
  try {
    const input = createMeetingSchema.parse(req.body);

    const meeting = await prisma.meeting.create({
      data: {
        roomId: createRoomId(),
        passcode: input.passcode || createPasscode(),
        title: input.title || "Untitled Meeting",
        createdById: req.user!.id,
        // isE2eeEnabled: Boolean(input.isE2eeEnabled),
        isE2eeEnabled: true, // E2EE by default
      },
    });

    return res.status(201).json({
      meeting,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create meeting";

    return res.status(400).json({
      message,
    });
  }
});

meetingRouter.post("/:roomId/verify-passcode", async (req, res) => {
  try {
    const input = verifyPasscodeSchema.parse(req.body);

    const meeting = await prisma.meeting.findUnique({
      where: {
        roomId: req.params.roomId,
      },
    });

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    const isHost = meeting.createdById === req.user!.id;
    const isValidPasscode = meeting.passcode === input.passcode;

    if (!isHost && !isValidPasscode) {
      return res.status(403).json({
        message: "Invalid meeting passcode",
      });
    }

    return res.json({
      allowed: true,
      meeting,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not verify passcode";

    return res.status(400).json({
      message,
    });
  }
});

meetingRouter.get("/", async (req, res) => {
  const meetings = await prisma.meeting.findMany({
    where: {
      createdById: req.user!.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.json({
    meetings,
  });
});

meetingRouter.get("/:roomId", async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: {
      roomId: req.params.roomId,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          username: true,
          email: true,
          // isE2eeEnabled: true,
        },
      },
    },
  });

  if (!meeting) {
    return res.status(404).json({
      message: "Meeting not found",
    });
  }

  return res.json({
    meeting,
  });
});
