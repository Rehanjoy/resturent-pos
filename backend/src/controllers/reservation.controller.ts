import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as reservationService from "../services/reservation.service";
import type { ReservationStatus } from "../models/reservation.model";

export const listReservations = asyncHandler(async (req: Request, res: Response) => {
  const reservations = await reservationService.listReservations(req.user!.restaurantId, {
    date: req.query.date as string | undefined,
    status: req.query.status as ReservationStatus | undefined,
  });
  res.status(200).json({ reservations });
});

export const getReservation = asyncHandler(async (req: Request, res: Response) => {
  const reservation = await reservationService.getReservation(
    req.user!.restaurantId,
    String(req.params.id),
  );
  res.status(200).json({ reservation });
});

export const createReservation = asyncHandler(async (req: Request, res: Response) => {
  const reservation = await reservationService.createReservation(
    req.user!.restaurantId,
    req.user!.userId,
    req.body,
  );
  res.status(201).json({ reservation });
});

export const updateReservation = asyncHandler(async (req: Request, res: Response) => {
  const reservation = await reservationService.updateReservation(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ reservation });
});

export const deleteReservation = asyncHandler(async (req: Request, res: Response) => {
  await reservationService.deleteReservation(req.user!.restaurantId, String(req.params.id));
  res.status(200).json({ message: "Reservation deleted." });
});

export const seatReservation = asyncHandler(async (req: Request, res: Response) => {
  const reservation = await reservationService.seatReservation(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ reservation });
});
