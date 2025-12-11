const mongoose = require("mongoose");

const MindmapSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },

    user_id: { type: String, ref: "User", required: false },

    title: { type: String },
    desc: { type: String },
    img: { type: String },

    status: { type: Boolean, default: true },

    // Stores the entire MindElixir data object
    data: { type: mongoose.Schema.Types.Mixed },



    favorite: { type: Boolean, default: false },

    deleted_at: { type: Date, default: null },
  },
  {
    collection: "mindmaps",

    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);
MindmapSchema.virtual("id")
  .get(function () {
    return this._id;
  })
  .set(function (v) {
    this._id = v;
  });


module.exports = mongoose.models.Mindmap || mongoose.model("Mindmap", MindmapSchema);
