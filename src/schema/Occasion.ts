import mongoose, { Schema } from "mongoose";

const occasionSchema = new Schema(
  {
    occasionTitle: {
      type: String,
      required: true,
    },

    occasionDescription: {
      type: String,
      required: true,
    },

    occasionImage: {
      type: String,
      required: true,
    },

    productCollection: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

occasionSchema.index({ occasionTitle: 1 }, { unique: true });

export default mongoose.model("Occasion", occasionSchema);
