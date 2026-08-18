import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as reportService from "../services/report.service";
import type { ReportRange } from "../utils/date-range";

interface RangeQuery {
  range: ReportRange;
  from?: string;
  to?: string;
}

export const getSalesReport = asyncHandler(async (req: Request, res: Response) => {
  const { range, from, to } = req.query as unknown as RangeQuery;
  const report = await reportService.getSalesReport(req.user!.restaurantId, range, from, to);
  res.status(200).json({ report });
});

export const getTopDishesReport = asyncHandler(async (req: Request, res: Response) => {
  const { range, from, to } = req.query as unknown as RangeQuery;
  const report = await reportService.getTopDishesReport(req.user!.restaurantId, range, from, to);
  res.status(200).json({ report });
});

export const getStaffPerformanceReport = asyncHandler(async (req: Request, res: Response) => {
  const { range, from, to } = req.query as unknown as RangeQuery;
  const report = await reportService.getStaffPerformanceReport(
    req.user!.restaurantId,
    range,
    from,
    to,
  );
  res.status(200).json({ report });
});

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const { range, from, to, report, format } = req.query as unknown as RangeQuery & {
    report: "sales" | "top-dishes";
    format: "csv";
  };
  void format; // only "csv" is supported for MVP — validated at the route, nothing else to branch on yet.
  const result = await reportService.exportReportCsv(req.user!.restaurantId, report, range, from, to);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.status(200).send(result.csv);
});
