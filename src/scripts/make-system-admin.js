import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/user.model.js";

async function makeSystemAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Replace with the email of YOUR registered account.
    const adminEmail = "your-email@example.com";

    const user = await User.findOneAndUpdate(
      { email: adminEmail.toLowerCase() },
      {
        $set: {
          isSystemAdmin: true,
          canCreateWorkspace: true,
        },
      },
      { new: true, runValidators: true },
    ).select("+isSystemAdmin");

    if (!user) {
      throw new Error(
        "User not found. Register your account before running this script.",
      );
    }

    console.log(`System admin configured: ${user.email}`);
  } catch (error) {
    console.error("Failed to configure system admin:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

makeSystemAdmin();
