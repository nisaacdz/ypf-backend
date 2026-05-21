import { Router } from "express";
import authRouter from "./auth";
import usersRouter from "./users";
import projectsRouter from "./projects";
import eventsRouter from "./events";
import membersRouter from "./members";
import chaptersRouter from "./chapters";
import committeesRouter from "./committees";
import webhooksRouter from "./webhooks";
import donationsRouter from "./donations";
import transactionsRouter from "./transactions";
import shopRouter from "./shop";
import announcementsRouter from "./announcements";
import applicationsRouter from "./applications";
import duesRouter from "./dues";
import partnershipsRouter from "./partnerships";
import dashboardRouter from "./dashboard";
import constituentsRouter from "./constituents";
import jobsRouter from "./jobs";
import certificatesRouter from "./certificates";
import workspacesRouter from "./workspaces";
import mediaRouter from "./media";
import contactRouter from "./contact";
import filesRouter from "./files";
import systemRouter from "./system";
import maintenanceRouter from "./maintenance";
import smsRouter from "./sms";
import publicTeamRouter from "./public-team";
import birthdaysRouter from "./birthdays";
import { maintenanceGate } from "@/shared/middlewares/maintenance";
import { authenticateLax } from "@/shared/middlewares/auth";

const apiRouter = Router();

// Maintenance gate runs before every route in the v1 API. It is a no-op when
// the flag is off; when on, it returns 503 for any non-safe method unless the
// request is from a super admin (who still needs to be able to disable it).
// authenticateLax populates req.User if a valid cookie is present so the gate
// can check the role; missing/invalid cookies just continue without a user.
apiRouter.use(authenticateLax, maintenanceGate);

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/members", membersRouter);
apiRouter.use("/chapters", chaptersRouter);
apiRouter.use("/committees", committeesRouter);
apiRouter.use("/webhooks", webhooksRouter);
apiRouter.use("/donations", donationsRouter);
apiRouter.use("/transactions", transactionsRouter);
apiRouter.use("/shop", shopRouter);
apiRouter.use("/announcements", announcementsRouter);
apiRouter.use("/applications", applicationsRouter);
apiRouter.use("/dues", duesRouter);
apiRouter.use("/partnerships", partnershipsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/constituents", constituentsRouter);
apiRouter.use("/jobs", jobsRouter);
apiRouter.use("/certificates", certificatesRouter);
apiRouter.use("/workspaces", workspacesRouter);
apiRouter.use("/media", mediaRouter);
apiRouter.use("/files", filesRouter);
apiRouter.use("/contact-submissions", contactRouter);
// Plan §8.3 — alias public POST under /contact for friendly URL.
apiRouter.use("/contact", contactRouter);
apiRouter.use("/system", systemRouter);
apiRouter.use("/maintenance", maintenanceRouter);
apiRouter.use("/sms", smsRouter);
apiRouter.use("/public-team", publicTeamRouter);
apiRouter.use("/birthdays", birthdaysRouter);

export default apiRouter;
