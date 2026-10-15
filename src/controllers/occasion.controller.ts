import { Request, Response } from "express";
import Errors, { HttpCode } from "../libs/Errors";
import OccasionService from "../models/Occasion.service";

const occasionService = new OccasionService();

const occasionController = {
  getOccasions: async (req: Request, res: Response) => {
    try {
      const result = await occasionService.getOccasions();

      res.status(HttpCode.OK).json({ result });
    } catch (err) {
      console.error("Error, getOccasions", err);

      if (err instanceof Errors) {
        res.status(err.code).json(err);
      } else {
        res.status(Errors.standard.code).json(Errors.standard);
      }
    }
  },
  createOccasion: async (req: Request, res: Response) => {
    try {
      const data = req.body;

      const result = await occasionService.createOccasion(data);

      res.status(HttpCode.CREATED).json({
        result,
      });
    } catch (err) {
      console.error("Error, createOccasion", err);

      if (err instanceof Errors) {
        res.status(err.code).json(err);
      } else {
        res.status(Errors.standard.code).json(Errors.standard);
      }
    }
  },
  updateOccasion: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      const result = await occasionService.updateOccasion(id, req.body);

      res.status(HttpCode.OK).json({
        result,
      });
    } catch (err) {
      console.error("Error, updateOccasion", err);

      if (err instanceof Errors) {
        res.status(err.code).json(err);
      } else {
        res.status(Errors.standard.code).json(Errors.standard);
      }
    }
  },
};

// GET ALL OCCASIONS

// CREATE OCCASION

// UPDATE OCCASION

export default occasionController;
