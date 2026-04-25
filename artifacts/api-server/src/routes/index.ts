import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import stationsRouter from "./stations";
import vendorsRouter from "./vendors";
import ridersRouter from "./riders";
import ordersRouter from "./orders";
import stockRouter from "./stock";
import paymentsRouter from "./payments";
import ticketsRouter from "./tickets";
import notificationsRouter from "./notifications";
import auditRouter from "./audit";
import dashboardRouter from "./dashboard";
import supportContactsRouter from "./support_contacts";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(stationsRouter);
router.use(vendorsRouter);
router.use(ridersRouter);
router.use(ordersRouter);
router.use(stockRouter);
router.use(paymentsRouter);
router.use(ticketsRouter);
router.use(notificationsRouter);
router.use(auditRouter);
router.use(dashboardRouter);
router.use(supportContactsRouter);
router.use(settingsRouter);

export default router;
