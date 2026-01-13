const User = require("../models/User");

/**
 * Function to create initial admin user if none exists
 */
const setupAdmin = async () => {
  try {
    // Check if any admin exists
    const adminExists = await User.findOne({ role: "admin" });

    if (!adminExists) {
      console.log("Creating initial admin user...");

      const adminUser = new User({
        username: "admin",
        email: "admin@company.com",
        password: "123123", // Change this in production
        firstName: "Admin",
        lastName: "01",
        role: "admin",
      });

      await adminUser.save();
      console.log("Admin user created successfully!");
    }
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
};

module.exports = setupAdmin;
