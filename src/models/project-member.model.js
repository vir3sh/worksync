import mongoose from "mongoose";

const projectMemberSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: ["lead", "member"],
      default: "member",
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "removed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate records for the same project and user.
projectMemberSchema.index({ project: 1, user: 1 }, { unique: true });

// Useful when retrieving projects for a workspace member.
projectMemberSchema.index({ workspace: 1, user: 1, status: 1 });

const ProjectMember = mongoose.model("ProjectMember", projectMemberSchema);

export default ProjectMember;
