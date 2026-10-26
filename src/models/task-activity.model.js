import mongoose from "mongoose";

const taskActivitySchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "status_changed",
        "assigned",
        "unassigned",
        "deleted",
      ],
      required: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

taskActivitySchema.index({ task: 1, createdAt: -1 });

const TaskActivity = mongoose.model("TaskActivity", taskActivitySchema);

export default TaskActivity;
