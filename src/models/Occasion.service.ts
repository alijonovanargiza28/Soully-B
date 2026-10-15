import Errors, { HttpCode, Message } from "../libs/Errors";

import OccasionModel from "../schema/Occasion";

class OccasionService {
  private readonly occasionModel;

  constructor() {
    this.occasionModel = OccasionModel;
  }

  // GET OCCASIONS

  public async getOccasions() {
    const result = await this.occasionModel.find().exec();

    if (!result) {
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    }

    return result;
  }

  // CREATE OCCASION

  public async createOccasion(input: {
    occasionTitle: string;
    occasionDescription: string;
    occasionImage: string;
    productCollection: string;
  }) {
    try {
      return await this.occasionModel.create(input);
    } catch (err) {
      console.error("Error, model:createOccasion", err);

      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  }

  // UPDATE OCCASION

  public async updateOccasion(
    id: string,
    input: {
      occasionTitle?: string;
      occasionDescription?: string;
      occasionImage?: string;
      productCollection?: string;
    },
  ) {
    const result = await this.occasionModel
      .findOneAndUpdate({ _id: id }, input, { new: true })
      .exec();

    if (!result) {
      throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    }

    return result;
  }
}

export default OccasionService;
