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

    // Share settings
    shared_with: [{
      user_id: { type: String, ref: "User" },
      email: { type: String },
      permission: { type: String, enum: ['view', 'edit'], default: 'view' },
      shared_at: { type: Date, default: Date.now }
    }],
    
    is_public: { type: Boolean, default: false },
    share_link: { type: String, default: null },
    public_permission: { type: String, enum: ['view', 'edit'], default: 'view' },

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
